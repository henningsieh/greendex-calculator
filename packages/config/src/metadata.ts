import { env } from "process";

import type {
  AppLinksAndroid,
  AppLinksApple,
  FacebookAppId,
} from "next/dist/lib/metadata/types/extra-types";

export const APP_NAME = "Greendex - Carbon Footprint Calculator";
export const TITLE =
  "Greendex - Carbon Footprint Calculator for Erasmus+ Projects";
export const DESCRIPTION =
  "Specialized carbon footprint calculator for Erasmus+ youth exchanges, training courses, and meetings. Calculate CO₂ emissions and discover how many trees are needed to offset your project's environmental impact.";
export const KEYWORDS = [
  "carbon footprint",
  "Erasmus+",
  "youth exchange",
  "sustainability",
  "CO₂ calculator",
  "environmental impact",
  "tree planting",
];
export const BASE_URL = env.NEXT_PUBLIC_BASE_URL || "https://greendex.world/";

// Constants for apps' metadata in the future:
export const ANDROID_PACKAGE: AppLinksAndroid["package"] = "";
export const IOS_APP_STORE_ID: AppLinksApple["app_store_id"] = "";
export const FACEBOOK_APP_ID: FacebookAppId["appId"] = "";

// Logo path configuration
export const LOGO_PATH = "/greendex_logo.png";
export const ICON_PATH = "/favicon/apple-touch-icon.png";
