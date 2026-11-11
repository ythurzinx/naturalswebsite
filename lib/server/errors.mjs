export class CheckoutError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "CheckoutError";
    this.code = code;
    this.status = status;
  }
}
export function reject(code, message, status = 400) {
  throw new CheckoutError(code, message, status);
}
