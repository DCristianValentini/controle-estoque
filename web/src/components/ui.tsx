import { forwardRef, useState } from 'react'
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

// -----------------------------------------------------------------------------
// Button
// -----------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  full?: boolean
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-sky-600 hover:bg-sky-700 text-white disabled:bg-sky-300',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:text-slate-400',
  danger: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-700',
}

export function Button({ variant = 'primary', full, className = '', type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-[clamp(0.82rem,0.78rem+0.2vw,0.92rem)] font-medium transition-colors disabled:cursor-not-allowed ${full ? 'w-full' : ''} ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  )
}

// -----------------------------------------------------------------------------
// Input / Textarea
// -----------------------------------------------------------------------------

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const CAMPO_CLASSES =
  'w-full rounded-lg border px-3 py-2.5 text-[clamp(0.88rem,0.84rem+0.15vw,1rem)] outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100'

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = '', id, name, ...props },
  ref,
) {
  const inputId = id ?? name
  return (
    <label className="block w-full text-left">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <input
        ref={ref}
        id={inputId}
        name={name}
        className={`${CAMPO_CLASSES} ${error ? 'border-red-400' : 'border-slate-300'} ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
})

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }

export function Textarea({ label, error, className = '', id, name, ...props }: TextareaProps) {
  const textareaId = id ?? name
  return (
    <label className="block w-full text-left">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <textarea
        id={textareaId}
        name={name}
        className={`${CAMPO_CLASSES} ${error ? 'border-red-400' : 'border-slate-300'} ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

// -----------------------------------------------------------------------------
// PasswordInput — todo campo de senha do sistema, sem exceção, precisa do
// botão de olho. O botão NUNCA pode roubar o foco do campo (onMouseDown com
// preventDefault) — em WebView, perder o foco fecha o teclado virtual.
// -----------------------------------------------------------------------------

const IconeOlho = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const IconeOlhoFechado = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
    />
  </svg>
)

type PasswordInputProps = Omit<InputProps, 'type'>

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { label, error, className = '', id, name, ...props },
  ref,
) {
  const [visivel, setVisivel] = useState(false)
  const inputId = id ?? name
  return (
    <label className="block w-full text-left">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={visivel ? 'text' : 'password'}
          className={`${CAMPO_CLASSES} pr-11 ${error ? 'border-red-400' : 'border-slate-300'} ${className}`}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisivel((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-700"
        >
          {visivel ? IconeOlhoFechado : IconeOlho}
        </button>
      </div>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
})

// -----------------------------------------------------------------------------
// Select
// -----------------------------------------------------------------------------

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
}

export function Select({ label, error, options, placeholder, className = '', id, name, ...props }: SelectProps) {
  const selectId = id ?? name
  return (
    <label className="block w-full text-left">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <select
        id={selectId}
        name={name}
        className={`${CAMPO_CLASSES} bg-white ${error ? 'border-red-400' : 'border-slate-300'} ${className}`}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

// -----------------------------------------------------------------------------
// Modal — vira bottom-sheet no mobile (ocupa a parte de baixo da tela).
// -----------------------------------------------------------------------------

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function Modal({ open, onClose, title, children, footer, wide }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[85vh] sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-slate-300 sm:hidden" />
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="min-w-0 truncate text-lg font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="ml-3 shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Card / Spinner / Badge
// -----------------------------------------------------------------------------

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

type BadgeTone = 'slate' | 'green' | 'red' | 'amber' | 'sky'

const BADGE_TONES: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  sky: 'bg-sky-100 text-sky-700',
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  )
}
