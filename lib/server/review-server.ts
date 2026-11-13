import "server-only";
import { repository, publicCatalog } from "./shop";
import { payments } from "./payments";
import { createReviewService } from "./review-service.mjs";
export const reviews = createReviewService({
  repository,
  payments,
  catalogProvider: publicCatalog,
});
