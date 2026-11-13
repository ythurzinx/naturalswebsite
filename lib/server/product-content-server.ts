import "server-only";
import { repository } from "./shop";
import { createProductContentService } from "./product-content.mjs";
export const productContent = createProductContentService({ repository });
