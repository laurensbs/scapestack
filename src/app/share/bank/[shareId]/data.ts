import { cache } from "react";
import { getPublicBankShare } from "@/lib/bank-share-repo";

export const loadPublicBankShare = cache(getPublicBankShare);
