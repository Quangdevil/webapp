// script.js
// Các hàm JS tách ra từ file gốc (đã lấy từ tab GitHub).
// Nếu file gốc còn hàm/logic khác, paste thêm vào đây.

function todayDateOnly() {
  try {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}
window.todayDateOnly = todayDateOnly;
try {
  var todayDateOnly = window.todayDateOnly;
} catch (e) {}

// HTML escape helper
function qdBootEsc(x) {
  try {
    if (typeof escHtml === 'function') return escHtml(x);
  } catch (e) {}
  return String(x == null ? '' : x).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

function qdBootVal(x) {
  return (x === undefined || x === null || x === '') ? '—' : qdBootEsc(x);
}

function qdBootReadRow(label, value) {
  return '<div class="m-read-row"><span>' + qdBootEsc(label) + '</span><b>' + qdBootVal(value) + '</b></div>';
}

function mobileStatusRead(l) {
  l = l || {};
  var st = l.status || 'Chờ bốc';
  try {
    if (typeof quickStatus === 'function') st = quickStatus(l);
  } catch (e) {}
  return [
    qdBootReadRow('Trạng thái hiện tại', st),
    qdBootReadRow('Xuất phát', l.vnDepartAt),
    qdBootReadRow('Lấy mẫu', l.sampleAt),
    qdBootReadRow('Có KQ', l.resultAt),
    qdBootReadRow('Kiểm dịch', l.quarantineAt),
    qdBootReadRow('CO', l.coAt),
    qdBootReadRow('Thông quan / sang khẩu', l.borderAt || l.cnCrossAt),
    qdBootReadRow('Kiểm hóa', l.inspectionAt),
    qdBootReadRow('Hậu kiểm', l.postcheckType),
    qdBootReadRow('Bỏ hàng / sang xe', l.unloadAt || l.cnTransferAt),
    qdBootReadRow('Tới chợ', l.cnArriveAt),
    qdBootReadRow('Đang bán', l.sellingAt),
    qdBootReadRow('Đã bán', l.soldAt)
  ].join('');
}
