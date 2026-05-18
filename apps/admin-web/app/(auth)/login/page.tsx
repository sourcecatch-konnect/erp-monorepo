"use client";

import { useForm } from "react-hook-form";
import { Input } from "@skerp/ui/components/input";
import { Button } from "@skerp/ui/components/button";
import { useAuth } from "../../hook/useAuth";
import { useState } from "react";
import { Label } from "@skerp/ui/components/lable";
type LoginForm = {
  email: string;
  password: string;
};

export default function LoginPage() {
const { login, loading, logout} = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();
const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
const onSubmit = async (data: LoginForm) => {
  try {
    setErrorMsg(null);
    await login({
      email: data.email,
      password: data.password,
    });
  } catch (err: any) {
    setErrorMsg(err.message);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 px-4">

      {/* Card */}
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">
            Admin Portal
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Sign in to access your dashboard
          </p>
        </div>

  {errorMsg && (
  <div className="mb-5 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
    {errorMsg}
  </div>
)}    

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* Email */}
          <div className="space-y-1">
           <Label htmlFor="email">Email</Label>
            <Input
            id="email"
              type="email"
              placeholder="admin@company.com"
              {...register("email", { required: "Email is required" })}
              className="h-11"
            />
            {errors.email && (
              <p className="text-xs text-red-500">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <Label htmlFor="password">Passowrd</Label>

            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                {...register("password", {
                  required: "Password is required",
                })}
                className="h-11 pr-12"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 text-sm"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {errors.password && (
              <p className="text-xs text-red-500">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Button */}
     <Button
  type="submit"
  disabled={loading}
  variant="primary"
  className="w-full h-11"
>
  {loading ? "Signing in..." : "Sign In"}
</Button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Secure Admin Access • ERP System
        </p>

      </div>
    </div>
  );
}