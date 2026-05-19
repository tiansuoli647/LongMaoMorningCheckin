const axios = require('axios');
const { encrypt } = require('../utils/rsa');

const BASE_URL = 'https://app.xtotoro.com';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { uuid } = req.query;
  if (!uuid) {
    return res.status(400).json({ code: '1', message: 'UUID is required' });
  }

  try {
    const pollResponse = await axios.get('https://long.open.weixin.qq.com/connect/l/qrconnect', {
      params: { uuid, f: 'json' },
      timeout: 30000 
    });

    const data = pollResponse.data;
    let errcode = null;
    let wxCode = null;

    if (typeof data === 'object') {
      errcode = (data.wx_errcode || data.errcode || '').toString();
      wxCode = data.wx_code || data.code;
    } else if (typeof data === 'string') {
      const errcodeMatch = data.match(/window\.wx_errcode\s*=\s*(\d+)/) || data.match(/"errcode"\s*:\s*(\d+)/);
      errcode = errcodeMatch ? errcodeMatch[1] : null;
      const codeMatch = data.match(/window\.wx_code\s*=\s*['"]([^'"]+)['"]/) || data.match(/"code"\s*:\s*["']([^"']+)["']/);
      wxCode = codeMatch ? codeMatch[1] : null;
    }

    if (errcode === '405') { 
      if (!wxCode) {
        throw new Error('Authorized but no code found');
      }

      // Step 1: Get Server Token
      const serverRequest = { code: wxCode };
      const encryptedServerRequest = encrypt(JSON.stringify(serverRequest));

      const serverListResponse = await axios.post(`${BASE_URL}/app/platform/serverlist/getLesseeServer`, encryptedServerRequest, {
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'okhttp/4.9.0' }
      });

      const serverData = serverListResponse.data;
      if (serverData.code !== '0') {
        return res.json({ status: 'error', message: `Server Token Error: ${serverData.message}` });
      }

      const serverToken = serverData.token;

      // Step 2: Final Login
      const loginRequest = {
        loginWay: '1', phoneNumber: '', password: '', code: wxCode,
        longitude: '116.397428', latitude: '39.908823', token: serverToken
      };

      const encryptedLoginRequest = encrypt(JSON.stringify(loginRequest));
      const loginResponse = await axios.post(`${BASE_URL}/app/platform/login/login`, encryptedLoginRequest, {
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'okhttp/4.9.0' }
      });

      const loginInfo = loginResponse.data;
      if (loginInfo.code !== '0') {
        return res.json({ status: 'error', message: `Login API Error: ${loginInfo.message}` });
      }

      if (!loginInfo.token) {
        loginInfo.token = serverToken;
      }

      return res.json({ status: 'success', userInfo: loginInfo });
    } else if (errcode === '404') {
      return res.json({ status: 'scanned', message: 'Scanned, please confirm on your phone' });
    } else if (errcode === '408') {
      return res.json({ status: 'pending', message: 'Waiting for scan' });
    } else if (errcode === '402') {
      return res.json({ status: 'expired', message: 'QR code expired' });
    } else {
      return res.json({ status: 'pending', message: 'Waiting for scan...' });
    }
  } catch (error) {
    console.error('Error during polling:', error.message);
    res.status(500).json({ code: '1', message: 'Server error during login' });
  }
};
