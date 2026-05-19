const axios = require('axios');
const cheerio = require('cheerio');

const WECHAT_APPID = 'wx20976a32c7a2fd75';

module.exports = async (req, res) => {
  // Add CORS headers for Vercel
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

  console.log('--- Requesting QR Code from WeChat ---');
  try {
    const response = await axios.get('https://open.weixin.qq.com/connect/app/qrconnect', {
      params: {
        appid: WECHAT_APPID,
        bundleid: '(com.totoro.school)',
        scope: 'snsapi_userinfo',
        state: '',
        from: 'message',
        isappinstalled: 0
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Mobile/12A365 MicroMessenger/5.4.1 NetType/WIFI WebView/doc'
      }
    });

    const $ = cheerio.load(response.data);
    const qrCodeUrl = $('.auth_qrcode').attr('src') || $('.qrcode').attr('src') || $('.img_code').attr('src');
    const uuidMatch = response.data.match(/uuid\s*[:=]\s*["']?([^"'\s,;]+)["']?/);
    const uuid = uuidMatch ? uuidMatch[1] : null;

    if (!uuid || !qrCodeUrl) {
      throw new Error(`Failed to extract QR code or UUID`);
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
};
