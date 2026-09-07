/**
 * Landing Page Types
 *
 * Type definitions for landing page components and features
 */

import { WORKSHOPS } from "@greendex/config/workshops";

/**
 * Navigation item for header menu
 */
export interface NavItem {
  href: string;
  label: string;
}

/**
 * Logo customer/partner
 */
export interface LogoCustomer {
  alt: string;
  src: string;
  width: number;
  height: number;
  className?: string;
}

/**
 * Greendex Workshop types
 */
export type WorkshopType = (typeof WORKSHOPS)[number]["id"];
