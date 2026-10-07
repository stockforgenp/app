import React from "react";
import stockforgeLogo from "@/src-tauri/icons/icon.png";

export { stockforgeLogo };

interface BrandLogoProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  alt?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = "",
  size = "md",
  alt = "StockForge Logo",
}) => {
  const sizeMap: Record<string, string> = {
    xs: "w-4 h-4",
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12",
    "2xl": "w-16 h-16",
  };

  return (
    <img
      src={stockforgeLogo}
      alt={alt}
      className={`object-contain shrink-0 ${sizeMap[size] || sizeMap.md} ${className}`}
    />
  );
};

export default BrandLogo;

