const API_BASE = '/api';
let pollInterval = null;
let currentUuid = null;
let currentUser = null;

const loginCard = document.getElementById('login-card');
const profileCard = document.getElementById('profile-card');
const qrcodeImg = document.getElementById('qrcode');
const loadingSpinner = document.getElementById('loading');
const statusOverlay = document.getElementById('status-overlay');
const statusText = document.getElementById('status-text');
const messageDiv = document.getElementById('message');
const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');

async function fetchQrCode() {
    stopPolling();
    loadingSpinner.style.display = 'block';
    qrcodeImg.style.display = 'none';
    statusOverlay.style.display = 'none';
    messageDiv.innerText = '正在获取二维码...';

    try {
        const response = await fetch(`${API_BASE}/login/qrcode`);
        const data = await response.json();

        if (data.uuid && data.qrCodeUrl) {
            currentUuid = data.uuid;
            qrcodeImg.src = data.qrCodeUrl;
            qrcodeImg.onload = () => {
                loadingSpinner.style.display = 'none';
                qrcodeImg.style.display = 'block';
                messageDiv.innerText = '请使用微信扫码';
                startPolling(data.uuid);
            };
        } else {
            throw new Error(data.message || '获取二维码失败');
        }
    } catch (error) {
        console.error('QR error:', error);
        messageDiv.innerText = '获取失败，请重试';
        loadingSpinner.style.display = 'none';
        showOverlay('获取失败', true);
    }
}

function startPolling(uuid) {
    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/login/poll?uuid=${uuid}`);
            const data = await response.json();

            if (data.status === 'success') {
                handleLoginSuccess(data.userInfo);
            } else if (data.status === 'scanned') {
                messageDiv.innerText = '已扫码，请在手机上确认';
            } else if (data.status === 'expired') {
                showOverlay('二维码已过期', true);
                stopPolling();
            } else if (data.status === 'error') {
                messageDiv.innerText = data.message || '登录出现错误';
                stopPolling();
                showOverlay('登录失败', true);
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 2000);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

function handleLoginSuccess(userInfo) {
    stopPolling();
    currentUser = userInfo;
    loginCard.style.display = 'none';
    profileCard.style.display = 'block';

    document.getElementById('user-avatar').src = userInfo.headPortrait || 'https://via.placeholder.com/80';
    document.getElementById('user-name').innerText = userInfo.stuName;
    document.getElementById('user-school').innerText = userInfo.schoolName;
    document.getElementById('user-student-id').innerText = `学号: ${userInfo.stuNumber}`;

    // Store token
    localStorage.setItem('totoro_token', userInfo.token);
    localStorage.setItem('totoro_user', JSON.stringify(userInfo));

    fetchSignTask();
}

async function fetchSignTask() {
    const pointListDiv = document.getElementById('point-list');
    pointListDiv.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';

    try {
        const response = await fetch(`${API_BASE}/sign/task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: currentUser.token,
                stuNumber: currentUser.stuNumber,
                phoneNumber: currentUser.phoneNumber,
                schoolId: currentUser.schoolId,
                campusId: currentUser.campusId
            })
        });

        const data = await response.json();
        if (data.code === '0') {
            updateTaskUI(data);
        } else {
            pointListDiv.innerHTML = `<p style="color:red; text-align:center;">${data.message || '获取任务失败'}</p>`;
        }
    } catch (error) {
        console.error('Task error:', error);
        pointListDiv.innerHTML = '<p style="color:red; text-align:center;">网络错误，请重试</p>';
    }
}

function updateTaskUI(data) {
    document.getElementById('need-count').innerText = data.dayNeedSignCount;
    document.getElementById('comp-count').innerText = data.dayCompSignCount;
    document.getElementById('task-time').innerText = `${data.startTime.substring(0,5)}-${data.endTime.substring(0,5)}`;

    const pointListDiv = document.getElementById('point-list');
    pointListDiv.innerHTML = '';

    if (data.signPointList && data.signPointList.length > 0) {
        data.signPointList.forEach(point => {
            const item = document.createElement('div');
            item.className = 'point-item';
            item.innerHTML = `
                <span class="point-name">${point.pointName}</span>
                <span class="point-coords">坐标: ${point.longitude}, ${point.latitude}</span>
                <div class="point-actions">
                    <button class="btn-sign btn-qr" onclick="submitSignIn('${point.pointId}', '${point.taskId}', '${point.longitude}', '${point.latitude}', '2', '${point.qrCode}')">一键签到</button>
                </div>
            `;
            pointListDiv.appendChild(item);
        });
    } else {
        pointListDiv.innerHTML = '<p style="text-align:center; color:#999;">当前没有可选的签到点</p>';
    }
}

function promptQr(pointId, taskId, lng, lat, defaultQr) {
    const qr = prompt('请输入签到二维码内容:', defaultQr || '');
    if (qr !== null) {
        submitSignIn(pointId, taskId, lng, lat, '2', qr);
    }
}

async function submitSignIn(pointId, taskId, lng, lat, signType, qrCode) {
    const originalText = messageDiv.innerText;
    messageDiv.innerText = '正在提交签到...';

    try {
        const response = await fetch(`${API_BASE}/sign/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: currentUser.token,
                stuNumber: currentUser.stuNumber,
                phoneNumber: currentUser.phoneNumber,
                qrCode: qrCode || '',
                longitude: lng,
                latitude: lat,
                taskId: taskId,
                pointId: pointId,
                signType: signType
            })
        });

        const data = await response.json();
        alert(data.message || (data.code === '0' ? '签到成功' : '签到失败'));
        
        if (data.code === '0') {
            fetchSignTask(); // Refresh task status
        }
    } catch (error) {
        console.error('Submit error:', error);
        alert('提交失败，请检查网络');
    } finally {
        messageDiv.innerText = originalText;
    }
}

function showOverlay(text, showButton) {
    statusOverlay.style.display = 'flex';
    statusText.innerText = text;
    refreshBtn.style.display = showButton ? 'block' : 'none';
}

refreshBtn.onclick = fetchQrCode;

logoutBtn.onclick = () => {
    localStorage.removeItem('totoro_token');
    profileCard.style.display = 'none';
    loginCard.style.display = 'block';
    fetchQrCode();
};

// Initial load
window.onload = () => {
    const savedToken = localStorage.getItem('totoro_token');
    if (savedToken) {
        // In a real app, you'd verify the token here
        // For now, we'll just show the login screen
        fetchQrCode();
    } else {
        fetchQrCode();
    }
};
