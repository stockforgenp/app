import React, { useState } from "react";
import {
  Store,
  Mail,
  Lock,
  UserPlus,
  Eye,
  EyeOff,
  Phone,
  MapPin,
  Tag,
  Coins,
} from "lucide-react";
import { SHOP_TYPES, CURRENCY_OPTIONS } from "@/src/constants";
import { useAuth } from "@/src/context/AuthContext.tsx";
import { useLanguage } from "@/src/context/LanguageContext.tsx";
import Input from "../common/Input";
import Select from "../common/Select";

interface Props {
  onSuccess?: () => void;
  onError: (error: string | null) => void;
}

export const RegisterForm: React.FC<Props> = ({ onSuccess, onError }) => {
  const { register } = useAuth();
  const { t, isNepali } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Registration form state
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    shop_type: "Grocery & Supermarket",
    address: "",
    currency_symbol: isNepali ? "रु." : "Rs.",
  });

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);

    if (!registerData.name.trim()) {
      onError(t("auth_err_shop_name_required"));
      return;
    }
    if (!registerData.email.trim() || !registerData.email.includes("@")) {
      onError(t("auth_err_email_invalid"));
      return;
    }
    if (registerData.password.length < 4) {
      onError(t("auth_err_password_length"));
      return;
    }
    if (registerData.password !== registerData.confirmPassword) {
      onError(t("auth_err_password_mismatch"));
      return;
    }

    setLoading(true);
    try {
      await register({
        name: registerData.name.trim(),
        email: registerData.email.trim(),
        password: registerData.password,
        phone: registerData.phone.trim() || undefined,
        shop_type: registerData.shop_type,
        address: registerData.address.trim() || undefined,
        currency_symbol:
          registerData.currency_symbol || (isNepali ? "रु." : "Rs."),
      });
      onSuccess?.();
    } catch (err: unknown) {
      onError((err as Error).message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleRegisterSubmit} className="space-y-4">
      {/* Shop Name */}
      <Input
        label={t("auth_shop_name")}
        icon={Store}
        type="text"
        required
        placeholder={t("auth_shop_name_placeholder")}
        value={registerData.name}
        onChange={(e) =>
          setRegisterData({ ...registerData, name: e.target.value })
        }
      />

      {/* Email and Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Input
          label={t("auth_owner_email")}
          icon={Mail}
          type="email"
          required
          placeholder="owner@store.com"
          value={registerData.email}
          onChange={(e) =>
            setRegisterData({
              ...registerData,
              email: e.target.value,
            })
          }
        />

        <Input
          label={t("auth_store_phone")}
          icon={Phone}
          type="tel"
          mono
          placeholder={t("auth_store_phone_placeholder")}
          value={registerData.phone}
          onChange={(e) =>
            setRegisterData({
              ...registerData,
              phone: e.target.value,
            })
          }
        />
      </div>

      {/* Shop Type and Currency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Select
          label={t("auth_shop_type")}
          icon={Tag}
          value={registerData.shop_type}
          onChange={(e) =>
            setRegisterData({
              ...registerData,
              shop_type: String(e.target.value),
            })
          }
          options={SHOP_TYPES}
        />

        <Select
          label={t("auth_currency")}
          icon={Coins}
          value={registerData.currency_symbol}
          onChange={(e) =>
            setRegisterData({
              ...registerData,
              currency_symbol: String(e.target.value),
            })
          }
          options={CURRENCY_OPTIONS}
        />
      </div>

      {/* Store Address */}
      <Input
        label={t("auth_address")}
        icon={MapPin}
        type="text"
        placeholder={t("auth_address_placeholder")}
        value={registerData.address}
        onChange={(e) =>
          setRegisterData({
            ...registerData,
            address: e.target.value,
          })
        }
      />

      {/* Passwords */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Input
          label={t("auth_password_register")}
          icon={Lock}
          type={showPassword ? "text" : "password"}
          required
          placeholder="••••••••"
          value={registerData.password}
          onChange={(e) =>
            setRegisterData({
              ...registerData,
              password: e.target.value,
            })
          }
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer flex items-center"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
          }
        />

        <Input
          label={t("auth_confirm_password")}
          icon={Lock}
          type={showPassword ? "text" : "password"}
          required
          placeholder="••••••••"
          value={registerData.confirmPassword}
          onChange={(e) =>
            setRegisterData({
              ...registerData,
              confirmPassword: e.target.value,
            })
          }
        />
      </div>

      {/* Submit Register Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
      >
        {loading ? (
          <span>{t("auth_creating_shop")}</span>
        ) : (
          <>
            <UserPlus className="w-4 h-4" />
            <span>{t("auth_btn_register")}</span>
          </>
        )}
      </button>
    </form>
  );
};
