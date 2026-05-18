import type { BillingStatus, CryptoPaymentRequest } from "@profilex/shared";
import { nanoid } from "nanoid";
import type { AppDatabase } from "../database/db.js";

const wallets = [
  { network: "USDT TRC20", address: process.env.BILLING_USDT_TRC20_WALLET ?? "Configure BILLING_USDT_TRC20_WALLET" },
  { network: "USDT ERC20", address: process.env.BILLING_USDT_ERC20_WALLET ?? "Configure BILLING_USDT_ERC20_WALLET" },
  { network: "BTC", address: process.env.BILLING_BTC_WALLET ?? "Configure BILLING_BTC_WALLET" }
];
export async function getBillingStatus(db: AppDatabase, organizationId: string): Promise<BillingStatus> {
  await db.exec(`INSERT INTO organization_billing (organization_id) VALUES ($1) ON CONFLICT (organization_id) DO NOTHING`, [organizationId]);
  const row = await db.one<any>(`SELECT * FROM organization_billing WHERE organization_id=$1`, [organizationId]);
  const expiresAt = new Date(row.expires_at);
  const expired = expiresAt.getTime() <= Date.now();
  const status = expired ? "expired" : row.status === "active" ? "active" : "trial";
  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000));
  return { status, plan: row.plan, expiresAt: expiresAt.toISOString(), daysLeft, canLaunch: !expired, paymentMethod: "crypto", wallets, lastPaymentAt: row.last_payment_at?.toISOString?.() ?? row.last_payment_at ?? undefined };
}
export async function assertLaunchAllowed(db: AppDatabase, organizationId: string) {
  const billing = await getBillingStatus(db, organizationId);
  if (!billing.canLaunch) {
    const error = new Error("License expired. Renew with crypto payment to launch profiles or RDP.") as Error & { statusCode?: number; code?: string };
    error.statusCode = 402; error.code = "LICENSE_EXPIRED"; throw error;
  }
  return billing;
}

export async function listPaymentRequests(db: AppDatabase, organizationId: string): Promise<CryptoPaymentRequest[]> {
  return (await db.query<any>(`SELECT * FROM crypto_payment_requests WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 20`, [organizationId])).map(mapPaymentRequest);
}
export async function createPaymentRequest(db: AppDatabase, organizationId: string, input: { network?: string; amountUsd?: number }) {
  const wallet = wallets.find((item) => item.network === input.network) ?? wallets[0];
  const amountUsd = Number(input.amountUsd ?? 49);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new Error("Payment amount must be positive.");
  const row = { id: nanoid(), network: wallet.network, amountUsd, walletAddress: wallet.address };
  await db.exec(`INSERT INTO crypto_payment_requests (id,organization_id,network,amount_usd,wallet_address) VALUES ($1,$2,$3,$4,$5)`, [row.id, organizationId, row.network, row.amountUsd, row.walletAddress]);
  return (await listPaymentRequests(db, organizationId))[0];
}
function mapPaymentRequest(row: any): CryptoPaymentRequest { return { id: row.id, network: row.network, amountUsd: Number(row.amount_usd), walletAddress: row.wallet_address, status: row.status, createdAt: row.created_at, paidAt: row.paid_at ?? undefined }; }
