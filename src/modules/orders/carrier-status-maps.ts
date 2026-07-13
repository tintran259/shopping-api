import { ShipmentStatus } from '../../common/enums';

/** Each carrier's own status vocabulary is far more granular than our coarse
 *  `ShipmentStatus`. We map every code a carrier can send onto the closest of
 *  PENDING/SHIPPED/IN_TRANSIT/DELIVERED/RETURNED/PROBLEM/PICKUP_FAILED: a failed
 *  delivery / return-to-sender → RETURNED (admin re-ships or cancels); a
 *  carrier not picking up the goods (before handover) → PICKUP_FAILED (goods
 *  still with us); a cancel / lost / damaged / return-fail after handover →
 *  PROBLEM (needs admin attention). `Shipment.carrierStatusRaw` still records the exact carrier
 *  value verbatim (see `ShipmentsService.handleCarrierUpdate`), so the precise
 *  sub-status is never lost even where several fold into one coarse value.
 *  ⚠️ GHN/GHTK vocabularies are transcribed from their public docs (best-effort,
 *  see CLAUDE.md) — re-verify against a real account before production. */
export const GHN_STATUS_MAP: Record<string, ShipmentStatus> = {
  ready_to_pick: ShipmentStatus.PENDING,
  money_collect_picking: ShipmentStatus.PENDING, // đang thu tiền người gửi (trước lấy hàng)
  picking: ShipmentStatus.SHIPPED, // đã lấy hàng
  picked: ShipmentStatus.SHIPPED,
  storing: ShipmentStatus.SHIPPED,
  transporting: ShipmentStatus.IN_TRANSIT, // đang vận chuyển
  sorting: ShipmentStatus.IN_TRANSIT,
  delivering: ShipmentStatus.IN_TRANSIT, // đang giao tới khách
  money_collect_delivering: ShipmentStatus.IN_TRANSIT, // đang thu COD khi giao
  delivered: ShipmentStatus.DELIVERED,
  delivery_fail: ShipmentStatus.RETURNED, // giao thất bại
  waiting_to_return: ShipmentStatus.RETURNED, // chờ trả hàng
  return: ShipmentStatus.RETURNED, // bắt đầu hoàn
  return_transporting: ShipmentStatus.RETURNED, // đang luân chuyển hàng hoàn
  return_sorting: ShipmentStatus.RETURNED, // đang phân loại hàng hoàn
  returning: ShipmentStatus.RETURNED, // đang hoàn về
  returned: ShipmentStatus.RETURNED, // đã hoàn về người gửi
  cancel: ShipmentStatus.PROBLEM, // carrier hủy đơn
  return_fail: ShipmentStatus.PROBLEM, // hoàn hàng thất bại
  exception: ShipmentStatus.PROBLEM, // đơn ngoại lệ
  damage: ShipmentStatus.PROBLEM, // hàng hư hỏng
  lost: ShipmentStatus.PROBLEM, // hàng thất lạc
};

/** GHTK's `status_id` (numeric, sent as a string in the webhook body) — see
 *  https://api.ghtk.vn/docs/submit-order/webhook/. */
export const GHTK_STATUS_MAP: Record<string, ShipmentStatus> = {
  '1': ShipmentStatus.PENDING, // chưa tiếp nhận
  '2': ShipmentStatus.PENDING, // đã tiếp nhận
  '8': ShipmentStatus.PENDING, // hoãn lấy hàng (vẫn chờ lấy)
  '12': ShipmentStatus.PENDING, // đang lấy hàng
  '3': ShipmentStatus.SHIPPED, // đã lấy hàng/nhập kho
  '4': ShipmentStatus.IN_TRANSIT, // đang trung chuyển
  '10': ShipmentStatus.IN_TRANSIT, // delay giao (vẫn đang giao)
  '5': ShipmentStatus.DELIVERED, // đã giao, chờ đối soát
  '6': ShipmentStatus.DELIVERED, // đã đối soát
  '9': ShipmentStatus.RETURNED, // không giao được
  '11': ShipmentStatus.RETURNED, // đã đối soát công nợ trả hàng
  '20': ShipmentStatus.RETURNED, // đang hoàn
  '21': ShipmentStatus.RETURNED, // đã hoàn
  '7': ShipmentStatus.PICKUP_FAILED, // không lấy được hàng (trước bàn giao)
  '-1': ShipmentStatus.PROBLEM, // hủy đơn
  '13': ShipmentStatus.PROBLEM, // đơn bồi hoàn
};

/** Looked up by `Shipment.carrier` — used by `ShipmentsService.simulateCarrierWebhook`
 *  (testing/mock-mode helper) to pick the right vocabulary for a given shipment
 *  without the caller needing to know which map belongs to which carrier. */
export const CARRIER_STATUS_MAPS: Record<
  string,
  Record<string, ShipmentStatus>
> = {
  GHN: GHN_STATUS_MAP,
  GHTK: GHTK_STATUS_MAP,
};
