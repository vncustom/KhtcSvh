/**
 * api/_nhipdo.js — Chặn dội yêu cầu.
 *
 * Apps Script chỉ có 90 phút chạy mỗi ngày. Không có lớp này, một kẻ gửi
 * yêu cầu liên tục có thể làm hệ thống ngừng hoạt động cả ngày.
 *
 * Bộ đếm nằm trong bộ nhớ của từng phiên bản hàm, nên khi Vercel chạy nhiều
 * phiên bản song song thì giới hạn thực tế nới ra theo số phiên bản. Đủ để
 * chặn kịch bản đơn giản; nếu sau này cần chặt hơn thì chuyển sang Vercel KV.
 */

import { loi } from './_gas.js';

const CUA_SO_MS = 60_000;
const TOI_DA = 60;

const bang = new Map();

export function kiemTraNhipDo(khoa, toiDa = TOI_DA) {
  const bayGio = Date.now();
  const muc = bang.get(khoa);

  if (!muc || bayGio > muc.het) {
    bang.set(khoa, { dem: 1, het: bayGio + CUA_SO_MS });
    donDep(bayGio);
    return;
  }

  muc.dem += 1;
  if (muc.dem > toiDa) {
    const con = Math.ceil((muc.het - bayGio) / 1000);
    throw loi(`Bạn thao tác quá nhanh. Vui lòng thử lại sau ${con} giây.`, 429);
  }
}

function donDep(bayGio) {
  if (bang.size < 500) return;
  for (const [k, v] of bang) if (bayGio > v.het) bang.delete(k);
}
