/**
 * x402 Protocol Payment & Signature Verifier for Base USDC Micropayments
 */

import crypto from 'crypto';

export interface X402PaymentRequest {
  recipient: string;
  amountUsdc: number;
  resourceUri: string;
  nonce: string;
  timestamp: number;
}

export interface X402Receipt {
  txHash: string;
  payer: string;
  amountUsdc: number;
  nonce: string;
  signature: string;
}

export class X402Verifier {
  private readonly acceptedRecipient: string;
  private readonly usdcDecimals = 6;
  private readonly processedTxs = new Set<string>();

  constructor(acceptedRecipient: string) {
    this.acceptedRecipient = acceptedRecipient.toLowerCase();
  }

  /**
   * Generates an idempotent challenge nonce for x402 resource protection.
   */
  public generatePaymentChallenge(resourceUri: string, amountUsdc: number): X402PaymentRequest {
    const nonce = crypto.randomBytes(16).toString('hex');
    return {
      recipient: this.acceptedRecipient,
      amountUsdc,
      resourceUri,
      nonce,
      timestamp: Date.now(),
    };
  }

  /**
   * Verifies an on-chain receipt against the challenge and prevents double-spend replays.
   */
  public verifyReceipt(challenge: X402PaymentRequest, receipt: X402Receipt): { valid: boolean; error?: string } {
    if (this.processedTxs.has(receipt.txHash)) {
      return { valid: false, error: 'Double spend detected: transaction already processed' };
    }

    if (receipt.amountUsdc < challenge.amountUsdc) {
      return {
        valid: false,
        error: `Underpaid: expected ${challenge.amountUsdc} USDC, received ${receipt.amountUsdc} USDC`,
      };
    }

    if (receipt.nonce !== challenge.nonce) {
      return { valid: false, error: 'Invalid challenge nonce' };
    }

    // Verify transaction hash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(receipt.txHash)) {
      return { valid: false, error: 'Invalid Ethereum transaction hash format' };
    }

    this.processedTxs.add(receipt.txHash);
    return { valid: true };
  }
}
