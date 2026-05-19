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

  if (req.method !== 'POST') {
    return res.status(405).json({ code: '1', message: 'Method not allowed' });
  }

  const { 
    token, stuNumber, phoneNumber, qrCode, longitude, latitude, 
    taskId, pointId, signType 
  } = req.body;

  try {
    const submitRequest = {
      stuNumber, phoneNumber, qrCode, headImage: '',
      baseStation: '460-00-12345-6789', longitude, latitude,
      phoneInfo: 'HUAWEI-P40|Android 12|EMUI 12.0',
      mac: '02:00:00:00:00:00', taskId, pointId, appVersion: '1.2.14',
      signType, token
    };

    const encryptedRequest = encrypt(JSON.stringify(submitRequest));
    const response = await axios.post(`${BASE_URL}/app/platform/recrecord/morningExercises`, encryptedRequest, {
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'okhttp/4.9.0' }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error submitting sign:', error.message);
    res.status(500).json({ code: '1', message: 'Failed to submit sign-in' });
  }
};
