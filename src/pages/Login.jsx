import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiMail, FiLock, FiArrowRight } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { ButtonLoader } from '../components/ui/Spinner'

export default function Login() {
  const { login, resetPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('login')
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (data) => {
    try {
      if (mode === 'reset') {
        await resetPassword(data.email)
        toast.success('Password reset email sent')
        setMode('login')
        return
      }
      await login(data.email, data.password)
      toast.success('Welcome back!')
      const dest = location.state?.from?.pathname || '/dashboard'
      navigate(dest, { replace: true })
    } catch (err) {
      toast.error(err.code === 'auth/invalid-credential' ? 'Invalid email or password' : err.message)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-primary p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <img src="/tuktuk.svg" alt="logo" className="h-10 w-10" />
          <div>
            <p className="text-lg font-bold">Tuk-Tuk</p>
            <p className="text-xs text-white/70">Sales Management System</p>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold leading-tight">
            Digitize your<br />e-mobility sales<br />workflow.
          </h1>
          <p className="mt-4 max-w-sm text-white/80">
            From customer inquiry to vehicle handover — manage customers, inventory, sales,
            credit loans and dispatch in one place.
          </p>
        </motion.div>
        <p className="text-xs text-white/50">© {new Date().getFullYear()} e-Mobility Co. All rights reserved.</p>
      </div>

      {/* Right form */}
      <div className="flex w-full items-center justify-center bg-background p-6 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 text-center lg:hidden">
            <img src="/tuktuk.svg" alt="logo" className="mx-auto h-12 w-12" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">
            {mode === 'reset' ? 'Reset Password' : 'Sign in to your account'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'reset'
              ? 'Enter your email to receive a reset link.'
              : 'Enter your credentials to access the dashboard.'}
          </p>

          {location.state?.deactivated && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              Your account has been deactivated. Contact the administrator.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  className="input pl-10"
                  placeholder="you@company.com"
                  {...register('email', { required: 'Email is required' })}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            {mode === 'login' && (
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    className="input pl-10"
                    placeholder="••••••••"
                    {...register('password', { required: 'Password is required' })}
                  />
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting && <ButtonLoader />}
              {mode === 'reset' ? 'Send Reset Link' : 'Sign In'}
              {!isSubmitting && <FiArrowRight />}
            </button>
          </form>

          <div className="mt-5 text-center text-sm">
            {mode === 'login' ? (
              <button onClick={() => setMode('reset')} className="font-medium text-primary hover:underline">
                Forgot password?
              </button>
            ) : (
              <button onClick={() => setMode('login')} className="font-medium text-primary hover:underline">
                Back to sign in
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
