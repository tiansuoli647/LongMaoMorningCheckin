const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cheerio = require('cheerio');
const path = require('path');
const { encrypt } = require('./utils/rsa');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// In-memory lock to prevent duplicate login attempts
const loginLocks = new Set();

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

const WECHAT_APPID = 'wx20976a32c7a2fd75';
const BASE_URL = 'https://app.xtotoro.com';

// Simplified QR Code Acquisition (REST API Recommend)
app.get('/api/login/qrcode', async (req, res) => {
  console.log('--- Requesting QR Code from WeChat ---');
  try {
    const response = await axios.get('https://open.weixin.qq.com/connect/app/qrconnect', {
      params: {
        appid: WECHAT_APPID,
        bundleid: '(com.totoro.school)', // Added parentheses as per doc example
        scope: 'snsapi_userinfo',
        state: '',
        from: 'message',
        isappinstalled: 0
      },
      timeout: 10000, // 10s timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Mobile/12A365 MicroMessenger/5.4.1 NetType/WIFI WebView/doc'
      }
    });

    console.log('--- WeChat Response Received ---');
    const $ = cheerio.load(response.data);
    
    // Try multiple common WeChat QR code selectors
    const qrCodeUrl = $('.auth_qrcode').attr('src') || $('.qrcode').attr('src') || $('.img_code').attr('src');
    
    // Improved regex to find UUID in the script block
    const uuidMatch = response.data.match(/uuid\s*[:=]\s*["']?([^"'\s,;]+)["']?/);
    const uuid = uuidMatch ? uuidMatch[1] : null;

    console.log(`--- Parsed: UUID=${!!uuid}, QR=${!!qrCodeUrl} ---`);

    if (!uuid || !qrCodeUrl) {
      console.log('--- Full Response Content for Debug ---');
      console.log(response.data); 
      throw new Error(`Failed to extract QR code (${!!qrCodeUrl}) or UUID (${!!uuid})`);
    }

    const fullQrUrl = qrCodeUrl.startsWith('http') ? qrCodeUrl : `https://open.weixin.qq.com${qrCodeUrl}`;
    
    res.json({
      uuid,
      qrCodeUrl: fullQrUrl
    });
  } catch (error) {
    console.error('Error fetching QR code:', error.message);
    res.status(500).json({ code: '1', message: error.message || 'Failed to fetch QR code' });
  }
});

// Polling for scan status
app.get('/api/login/poll', async (req, res) => {
  const { uuid } = req.query;
  if (!uuid) {
    return res.status(400).json({ code: '1', message: 'UUID is required' });
  }

  try {
    // WeChat long polling
    const pollResponse = await axios.get('https://long.open.weixin.qq.com/connect/l/qrconnect', {
      params: {
        uuid,
        f: 'json'
      },
      timeout: 30000 
    });

    const data = pollResponse.data;
    let errcode = null;
    let wxCode = null;

    if (typeof data === 'object') {
      errcode = (data.wx_errcode || data.errcode || '').toString();
      wxCode = data.wx_code || data.code;
    } else if (typeof data === 'string') {
      // Fallback to regex if WeChat returns a script string even with f=json
      const errcodeMatch = data.match(/window\.wx_errcode\s*=\s*(\d+)/) || data.match(/"errcode"\s*:\s*(\d+)/);
      errcode = errcodeMatch ? errcodeMatch[1] : null;

      const codeMatch = data.match(/window\.wx_code\s*=\s*['"]([^'"]+)['"]/) || data.match(/"code"\s*:\s*["']([^"']+)["']/);
      wxCode = codeMatch ? codeMatch[1] : null;
    }

    console.log(`--- WeChat Polling Raw: ${typeof data === 'string' ? data : JSON.stringify(data)} ---`);
    console.log(`--- WeChat Polling: uuid=${uuid}, errcode=${errcode} ---`);

    if (errcode === '405') { // Authorized
      // Check if this UUID is already being processed
      if (loginLocks.has(uuid)) {
        console.log(`--- Login already in progress for uuid: ${uuid}, skipping ---`);
        return res.json({ status: 'pending', message: 'Processing login...' });
      }

      console.log(`--- WeChat Authorized! Code: ${wxCode} ---`);

      if (!wxCode) {
        throw new Error('Authorized but no code found in response');
      }

      // Set lock
      loginLocks.add(uuid);

      try {
        // Step 1: Get Server Token (Totoro API)
        console.log('--- Step 1: Requesting Lessee Server Token ---');
        const serverRequest = { code: wxCode };
        const encryptedServerRequest = encrypt(JSON.stringify(serverRequest));

        const serverListResponse = await axios.post(`${BASE_URL}/app/platform/serverlist/getLesseeServer`, encryptedServerRequest, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'okhttp/4.9.0'
          }
        });

        const serverData = serverListResponse.data;
        console.log('--- Step 1 Response:', JSON.stringify(serverData), '---');
        
        if (serverData.code !== '0') {
          loginLocks.delete(uuid);
          return res.json({ status: 'error', message: `Server Token Error: ${serverData.message}` });
        }

        const serverToken = serverData.token;

        // Step 2: Final Login (Totoro API)
        console.log('--- Step 2: Executing Final Login ---');
        const loginRequest = {
          loginWay: '1',
          phoneNumber: '',
          password: '',
          code: wxCode,
          longitude: '116.397428',
          latitude: '39.908823',
          token: serverToken
        };

        const encryptedLoginRequest = encrypt(JSON.stringify(loginRequest));

        const loginResponse = await axios.post(`${BASE_URL}/app/platform/login/login`, encryptedLoginRequest, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'okhttp/4.9.0'
          }
        });

        const loginInfo = loginResponse.data;
        console.log('--- Step 2 Response:', JSON.stringify(loginInfo), '---');

        if (loginInfo.code !== '0') {
          loginLocks.delete(uuid);
          return res.json({ status: 'error', message: `Login API Error: ${loginInfo.message}` });
        }

        // IMPORTANT: Fallback to serverToken if loginInfo.token is null
        if (!loginInfo.token) {
          console.log('--- Warning: LoginInfo.token is null, using serverToken from Step 1 ---');
          loginInfo.token = serverToken;
        }

        console.log('--- Login Successful for:', loginInfo.stuName, '---');
        return res.json({
          status: 'success',
          userInfo: loginInfo
        });
      } finally {
        // Clean up lock after a delay to ensure frontend has stopped polling
        setTimeout(() => loginLocks.delete(uuid), 5000);
      }
    } else if (errcode === '404') { // Scanned but not confirmed
      return res.json({ status: 'scanned', message: 'Scanned, please confirm on your phone' });
    } else if (errcode === '408') { // Waiting
      return res.json({ status: 'pending', message: 'Waiting for scan' });
    } else if (errcode === '402') { // Expired
      return res.json({ status: 'expired', message: 'QR code expired' });
    } else {
      return res.json({ status: 'pending', message: 'Waiting for scan...' });
    }

  } catch (error) {
    console.error('Error during polling or login:', error.message);
    res.status(500).json({ code: '1', message: 'Server error during login process' });
  }
});

// Get Morning Sign-in Task
app.post('/api/sign/task', async (req, res) => {
  const { token, stuNumber, phoneNumber, schoolId, campusId } = req.body;
  
  try {
    const taskRequest = {
      stuNumber,
      phoneNumber,
      schoolId,
      campusId,
      token
    };

    const encryptedRequest = encrypt(JSON.stringify(taskRequest));
    const response = await axios.post(`${BASE_URL}/app/mornsign/getMornSignPaper`, encryptedRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'okhttp/4.9.0'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching sign task:', error.message);
    res.status(500).json({ code: '1', message: 'Failed to fetch sign task' });
  }
});

// Submit Morning Sign-in
app.post('/api/sign/submit', async (req, res) => {
  const { 
    token, stuNumber, phoneNumber, qrCode, longitude, latitude, 
    taskId, pointId, signType 
  } = req.body;

  try {
    const submitRequest = {
      stuNumber,
      phoneNumber,
      qrCode,
      headImage: '', // Explicitly empty as per "no face" requirement
      baseStation: '460-00-12345-6789', // Default placeholder
      longitude,
      latitude,
      phoneInfo: 'HUAWEI-P40|Android 12|EMUI 12.0',
      mac: '02:00:00:00:00:00',
      taskId,
      pointId,
      appVersion: '1.2.14',
      signType,
      token
    };

    const encryptedRequest = encrypt(JSON.stringify(submitRequest));
    const response = await axios.post(`${BASE_URL}/app/platform/recrecord/morningExercises`, encryptedRequest, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'okhttp/4.9.0'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error submitting sign:', error.message);
    res.status(500).json({ code: '1', message: 'Failed to submit sign-in' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
