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

  const { token, stuNumber, phoneNumber, schoolId, campusId } = req.body;
  
  try {
    const taskRequest = { stuNumber, phoneNumber, schoolId, campusId, token };
    const encryptedRequest = encrypt(JSON.stringify(taskRequest));
    const response = await axios.post(`${BASE_URL}/app/mornsign/getMornSignPaper`, encryptedRequest, {
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'okhttp/4.9.0' }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching sign task:', error.message);
    res.status(500).json({ code: '1', message: 'Failed to fetch sign task' });
  }
};
