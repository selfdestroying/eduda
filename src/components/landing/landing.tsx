'use client'

import '@/src/styles/landing.css'

import {
  ArrowRight as ArrowRightIcon,
  Bell,
  Calendar,
  CalendarCheck,
  Check,
  ChevronDown,
  CircleX,
  Coins,
  DollarSign,
  LayoutGrid,
  Menu,
  Moon,
  Shield,
  Star as StarIcon,
  Sun,
  Users,
  Wallet,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import { Logo } from '@/src/components/logo'
import { DemoLaunchButton } from '@/src/features/demo/components/demo-launch-button'
import { authClient } from '@/src/lib/auth/client'
import { protocol, rootDomain } from '@/src/lib/utils'
import { Reveal } from './reveal'

/* ─── Иконки ─────────────────────────────────────────────────────────────── */

function CheckIcon({ size = 16, color = 'var(--primary)', strokeWidth = 2.4 }) {
  return <Check size={size} color={color} strokeWidth={strokeWidth} style={{ flex: 'none' }} />
}

function ArrowRight({ size = 18, strokeWidth = 2 }) {
  return <ArrowRightIcon size={size} strokeWidth={strokeWidth} />
}

function Star() {
  return <StarIcon size={16} fill="var(--primary)" stroke="none" />
}

/* ─── Общие стили ────────────────────────────────────────────────────────── */

const container: CSSProperties = { maxWidth: 1200, margin: '0 auto' }
const eyebrow: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--primary)',
  textTransform: 'uppercase',
  letterSpacing: '.1em',
  marginBottom: 14,
}
const h2: CSSProperties = {
  fontSize: 'clamp(28px,3.6vw,42px)',
  lineHeight: 1.1,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  marginBottom: 16,
}
const lead: CSSProperties = { fontSize: 17, lineHeight: 1.6, color: 'var(--muted-foreground)' }
const primaryCta: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'var(--primary)',
  color: 'var(--primary-foreground)',
  fontWeight: 600,
  fontSize: 16,
  padding: '14px 26px',
  borderRadius: 12,
  boxShadow: 'var(--shadow-cta)',
}

/* ─── Данные ─────────────────────────────────────────────────────────────── */

const FAQ = [
  {
    q: 'Данные в безопасности?',
    a: 'Да. Каждая школа работает на собственном поддомене, доступ разграничен по ролям, а данные хранятся в защищённой инфраструктуре с регулярным резервным копированием.',
  },
  {
    q: 'Насколько сложно перенести данные из Excel?',
    a: 'Несложно. Ученики, группы и балансы импортируются из таблиц, а на тарифе «Сеть» перенос данных берёт на себя наша команда.',
  },
  {
    q: 'Можно ли ограничить, что видят сотрудники?',
    a: 'Да. Роли «владелец», «менеджер» и «преподаватель» видят только то, что им нужно: преподаватель — свои уроки, менеджер — оплаты, владелец — финансы целиком.',
  },
  {
    q: 'Как родители получают доступ?',
    a: 'По персональной ссылке — без регистрации и паролей. Родитель видит всех своих детей, посещаемость, финансы и расписание в одном кабинете.',
  },
  {
    q: 'Можно ли отменить подписку?',
    a: 'В любой момент, без штрафов и звонков. Первые 14 дней бесплатны и не требуют привязки карты.',
  },
  {
    q: 'Есть ли поддержка при запуске?',
    a: 'Да. Помогаем на старте, отвечаем в Telegram и по почте, а на старших тарифах подключаем приоритетную поддержку.',
  },
]

/* ─── Компонент ──────────────────────────────────────────────────────────── */

export function Landing({ signInUrl }: { signInUrl: string }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)

  // Если пользователь уже вошёл — ведём сразу в его школу, минуя цепочку
  // редиректов auth → sign-in → поддомен (из-за неё страница несколько раз мигает).
  const { data: session } = authClient.useSession()
  const orgSlug = session?.organization?.slug
  const enterHref = orgSlug ? `${protocol}://${orgSlug}.${rootDomain}` : signInUrl

  const navLinks = [
    { href: '#features', label: 'Возможности' },
    { href: '#how', label: 'Как это работает' },
    { href: '#pricing', label: 'Тарифы' },
    { href: '#faq', label: 'FAQ' },
  ]

  return (
    <div
      className="eduda-landing"
      style={{ minHeight: '100dvh', background: 'var(--background)', color: 'var(--foreground)' }}
    >
      {/* ===== HEADER ===== */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(12px)',
          background: 'color-mix(in oklch, var(--background) 82%, transparent)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            ...container,
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <a
            href="#top"
            style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--foreground)' }}
          >
            <Logo className="text-primary" style={{ width: 30, height: 30, flex: 'none' }} />
            <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: '.02em' }}>ЕДУДА</span>
          </a>
          <nav className="eduda-desknav" style={{ display: 'flex', gap: 4, marginLeft: 24 }}>
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                style={{ fontSize: 14, fontWeight: 500, padding: '8px 12px', borderRadius: 8 }}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle />
            <Link
              href={enterHref}
              className="eduda-login hover:bg-muted transition-colors"
              style={{
                display: 'none',
                alignItems: 'center',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--foreground)',
                padding: '9px 14px',
                borderRadius: 10,
              }}
            >
              Войти
            </Link>
            <Link
              href={enterHref}
              className="transition-opacity hover:opacity-90"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                fontWeight: 600,
                fontSize: 14,
                padding: '10px 16px',
                borderRadius: 10,
                boxShadow: 'var(--shadow-cta-sm)',
              }}
            >
              Попробовать бесплатно
            </Link>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Меню"
              className="eduda-burger hover:bg-muted transition-colors"
              style={{
                width: 38,
                height: 38,
                flex: 'none',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border)',
                background: 'var(--background)',
                borderRadius: 10,
                color: 'var(--foreground)',
              }}
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div
            style={{
              borderTop: '1px solid var(--border)',
              background: 'var(--background)',
              padding: '10px 24px 18px',
            }}
          >
            {navLinks.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'block',
                  padding: '11px 4px',
                  color: 'var(--foreground)',
                  fontWeight: 500,
                  borderBottom: i < navLinks.length - 1 ? '1px solid var(--border)' : undefined,
                }}
              >
                {l.label}
              </a>
            ))}
            <Link
              href={enterHref}
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'block',
                textAlign: 'center',
                marginTop: 14,
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                fontWeight: 600,
                padding: 12,
                borderRadius: 10,
              }}
            >
              Попробовать бесплатно
            </Link>
          </div>
        )}
      </header>

      <main id="top">
        {/* ===== HERO ===== */}
        <section
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
          >
            <div
              style={{
                position: 'absolute',
                top: -120,
                left: -80,
                width: 460,
                height: 460,
                borderRadius: '50%',
                background: 'color-mix(in oklch, var(--primary) 16%, transparent)',
                filter: 'blur(90px)',
                animation: 'edudaFloat 14s ease-in-out infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 120,
                right: -120,
                width: 420,
                height: 420,
                borderRadius: '50%',
                background: 'color-mix(in oklch, var(--primary) 12%, transparent)',
                filter: 'blur(90px)',
                animation: 'edudaFloat 18s ease-in-out infinite reverse',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)',
                backgroundSize: '64px 64px',
                opacity: 0.35,
                maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%,black,transparent)',
              }}
            />
          </div>
          <div
            className="eduda-herogrid"
            style={{
              position: 'relative',
              ...container,
              padding: '72px 24px 40px',
              display: 'grid',
              gridTemplateColumns: '1.05fr .95fr',
              gap: 48,
              alignItems: 'center',
            }}
          >
            <Reveal>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 9999,
                  background: 'color-mix(in oklch, var(--primary) 10%, transparent)',
                  color: 'var(--primary)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  marginBottom: 22,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    animation: 'edudaPulse 2.4s ease-in-out infinite',
                  }}
                />
                Для учебных центров, языковых школ и детских клубов
              </div>
              <h1
                style={{
                  fontSize: 'clamp(38px,5.4vw,62px)',
                  lineHeight: 1.04,
                  fontWeight: 700,
                  letterSpacing: '-0.025em',
                  marginBottom: 20,
                }}
              >
                Управляйте учебным центром,
                <br />
                <span style={{ color: 'var(--primary)' }}>а не таблицами.</span>
              </h1>
              <p
                style={{
                  fontSize: 'clamp(16px,1.7vw,19px)',
                  lineHeight: 1.6,
                  color: 'var(--muted-foreground)',
                  maxWidth: 540,
                  marginBottom: 30,
                }}
              >
                ЕДУДА объединяет учеников, посещаемость, финансы и мотивацию в одной платформе.
                Меньше рутины, больше прибыли и довольных родителей.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 26 }}>
                <Link
                  href={enterHref}
                  className="transition-opacity hover:opacity-90"
                  style={primaryCta}
                >
                  Попробовать бесплатно
                  <ArrowRight />
                </Link>
                <DemoLaunchButton
                  className="hover:bg-muted cursor-pointer transition-colors disabled:opacity-70"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                    fontWeight: 600,
                    fontSize: 16,
                    padding: '14px 24px',
                    borderRadius: 12,
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  color: 'var(--muted-foreground)',
                  fontSize: 13,
                  flexWrap: 'wrap',
                }}
              >
                {['14 дней бесплатно', 'Без карты', 'Отмена в любой момент'].map((t) => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <CheckIcon size={15} />
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>

            {/* Макет дашборда */}
            <Reveal delay={0.12}>
              <div
                style={{
                  borderRadius: 18,
                  background: 'var(--card)',
                  boxShadow: 'var(--shadow-modal),var(--ring-card)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--muted)',
                  }}
                >
                  <span
                    style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }}
                  />
                  <span
                    style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }}
                  />
                  <span
                    style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }}
                  />
                  <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--muted-foreground)' }}>
                    школа.eduda.online
                  </span>
                </div>
                <div style={{ display: 'flex' }}>
                  <div
                    style={{
                      width: 52,
                      flex: 'none',
                      background: 'var(--sidebar)',
                      borderRight: '1px solid var(--border)',
                      padding: '12px 0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    <Logo className="text-primary" style={{ width: 26, height: 26 }} />
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: 'color-mix(in oklch, var(--primary) 12%, transparent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                      }}
                    >
                      <LayoutGrid size={14} />
                    </span>
                    {[Users, Calendar, DollarSign].map((Icon, i) => (
                      <span
                        key={i}
                        style={{
                          width: 26,
                          height: 26,
                          color: 'var(--muted-foreground)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon size={14} />
                      </span>
                    ))}
                  </div>
                  <div style={{ flex: 1, padding: 14, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 12,
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Обзор · Октябрь</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 9999,
                          background: 'color-mix(in oklch, var(--success) 12%, transparent)',
                          color: 'var(--success)',
                        }}
                      >
                        +18% к сентябрю
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      {[
                        ['Выручка', '842 300 ₽'],
                        ['Прибыль', '312 100 ₽'],
                        ['Ученики', '248'],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          style={{
                            padding: '9px 10px',
                            borderRadius: 10,
                            background: 'var(--card)',
                            boxShadow: 'var(--ring-card)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 9.5,
                              color: 'var(--muted-foreground)',
                              marginBottom: 3,
                            }}
                          >
                            {label}
                          </div>
                          <div className="eduda-num" style={{ fontSize: 15, fontWeight: 700 }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        padding: 11,
                        borderRadius: 10,
                        background: 'var(--card)',
                        boxShadow: 'var(--ring-card)',
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'space-between',
                          height: 66,
                          gap: 6,
                        }}
                      >
                        {[
                          [38, 22],
                          [52, 30],
                          [44, 26],
                          [70, 40],
                          [60, 34],
                          [88, 100],
                        ].map(([h, mix], i) => (
                          <div
                            key={i}
                            style={{
                              width: '100%',
                              height: `${h}%`,
                              background:
                                mix === 100
                                  ? 'var(--primary)'
                                  : `color-mix(in oklch, var(--primary) ${mix}%, transparent)`,
                              borderRadius: '4px 4px 0 0',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '10px 11px',
                        borderRadius: 10,
                        background: 'color-mix(in oklch, var(--primary) 7%, transparent)',
                        border: '1px solid color-mix(in oklch, var(--primary) 18%, transparent)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--primary)',
                          marginBottom: 6,
                        }}
                      >
                        <Bell size={13} />
                        Умная лента · 3 задачи
                      </div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: 'var(--muted-foreground)',
                          lineHeight: 1.5,
                        }}
                      >
                        Не отмечена посещаемость в «Английский B1» · У 4 учеников заканчивается
                        баланс
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
          {/* Полоса «заменяет инструменты» */}
          <Reveal style={{ ...container, padding: '8px 24px 40px' }}>
            <p
              style={{
                textAlign: 'center',
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '.12em',
                color: 'var(--muted-foreground)',
                marginBottom: 18,
              }}
            >
              Заменяет десяток инструментов
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
              {[
                'Excel-таблицы',
                'Чаты в мессенджерах',
                'Бумажные журналы',
                'Калькулятор зарплат',
              ].map((t) => (
                <span
                  key={t}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9999,
                    background: 'var(--muted)',
                    color: 'var(--muted-foreground)',
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: 'line-through',
                  }}
                >
                  {t}
                </span>
              ))}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 16px',
                  borderRadius: 9999,
                  background: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <Logo className="text-primary-foreground" style={{ width: 16, height: 16 }} />
                ЕДУДА
              </span>
            </div>
          </Reveal>
        </section>

        {/* ===== ПРОБЛЕМА → РЕШЕНИЕ ===== */}
        <section>
          <Reveal style={{ ...container, padding: '80px 24px' }}>
            <div style={{ textAlign: 'center', maxWidth: 660, margin: '0 auto 48px' }}>
              <div style={eyebrow}>Знакомо?</div>
              <h2 style={h2}>Школа растёт — а хаоса всё больше</h2>
              <p style={lead}>
                Данные разбросаны по таблицам, чатам и бумаге. Никто не видит полной картины по
                деньгам, а рутина съедает вечера.
              </p>
            </div>
            <div
              className="eduda-pas"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: 28,
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  ['Деньги теряются', 'Забытые оплаты, непонятные балансы, зарплаты «на глаз».'],
                  [
                    'Рутина без конца',
                    'Посещаемость вручную, отчёты по вечерам, вечные пересчёты.',
                  ],
                  [
                    'Родители в неведении',
                    'Вопросы «а что с оплатой?» и «был ли ребёнок?» каждый день.',
                  ],
                ].map(([title, text]) => (
                  <div
                    key={title}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '16px 18px',
                      borderRadius: 14,
                      background: 'color-mix(in oklch, var(--destructive) 6%, var(--card))',
                      boxShadow: 'var(--ring-card)',
                    }}
                  >
                    <CircleX
                      size={20}
                      color="var(--destructive)"
                      style={{ flex: 'none', marginTop: 1 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{title}</div>
                      <p
                        style={{
                          fontSize: 13.5,
                          color: 'var(--muted-foreground)',
                          lineHeight: 1.5,
                        }}
                      >
                        {text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="eduda-pasarrow"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6px 18px rgba(76,29,149,.3)',
                    color: 'var(--primary-foreground)',
                  }}
                >
                  <ArrowRight size={24} strokeWidth={2.2} />
                </div>
              </div>
              <div
                style={{
                  padding: 28,
                  borderRadius: 18,
                  background: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  boxShadow: '0 20px 40px -12px rgba(76,29,149,.4)',
                }}
              >
                <Logo
                  className="text-primary-foreground"
                  style={{ width: 34, height: 34, marginBottom: 16 }}
                />
                <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
                  Одна система вместо десяти
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.9, marginBottom: 18 }}>
                  ЕДУДА собирает учеников, расписание, деньги и мотивацию в одном месте. Всё
                  связано, всё считается автоматически, всё под контролем.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    'Полная картина по финансам',
                    'Меньше ручной работы каждый день',
                    'Прозрачность для родителей',
                  ].map((t) => (
                    <div
                      key={t}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14 }}
                    >
                      <CheckIcon size={17} color="currentColor" />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ===== ВОЗМОЖНОСТИ ===== */}
        <section
          id="features"
          style={{
            background: 'var(--muted)',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ ...container, padding: '80px 24px' }}>
            <Reveal style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 52px' }}>
              <div style={eyebrow}>Возможности</div>
              <h2 style={h2}>Всё, чтобы вести школу без таблиц</h2>
              <p style={lead}>Включайте только нужные модули — остальное не будет мешать.</p>
            </Reveal>

            {/* Фича 1: финансы (текст слева) */}
            <Reveal
              className="eduda-frow"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 48,
                alignItems: 'center',
                marginBottom: 64,
              }}
            >
              <div>
                <FeatureIconBox>
                  <Wallet size={24} />
                </FeatureIconBox>
                <h3 style={featureTitle}>Полный контроль над деньгами</h3>
                <p style={featureText}>
                  Оплаты, балансы уроков, выручка, авансы, аренда, зарплаты преподавателей и
                  менеджеров по ставкам — прибыль по месяцам считается автоматически. Никаких
                  калькуляторов в конце месяца.
                </p>
                <FeatureList
                  items={[
                    'Кошельки учеников и баланс уроков',
                    'Зарплаты по ставкам и «неразобранные» платежи',
                    'Прибыль по месяцам в один клик',
                  ]}
                />
              </div>
              <div style={mockCard}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 14,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Финансы за месяц</span>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                    Октябрь 2026
                  </span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ padding: 12, borderRadius: 10, background: 'var(--muted)' }}>
                    <div
                      style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}
                    >
                      Выручка
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>842 300 ₽</div>
                  </div>
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: 'color-mix(in oklch, var(--success) 9%, transparent)',
                    }}
                  >
                    <div
                      style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}
                    >
                      Прибыль
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>
                      312 100 ₽
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['Зарплаты преподавателей', '384 200 ₽', undefined],
                    ['Аренда', '96 000 ₽', undefined],
                    ['Налоги', '50 000 ₽', undefined],
                  ].map(([label, value, color], i) => (
                    <div
                      key={label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13,
                        padding: '8px 0',
                        borderBottom: i < 2 ? '1px solid var(--border)' : undefined,
                      }}
                    >
                      <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
                      <span style={{ fontWeight: 600, color }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Фича 2: расписание (макет слева) */}
            <Reveal
              className="eduda-frow eduda-frow-rev"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 48,
                alignItems: 'center',
                marginBottom: 64,
              }}
            >
              <div className="eduda-mockcol" style={mockCard}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 14,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Расписание · Пн 12 окт</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 9999,
                      background: 'color-mix(in oklch, var(--primary) 12%, transparent)',
                      color: 'var(--primary)',
                    }}
                  >
                    6 уроков
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ScheduleRow
                    time="10:00"
                    title="Английский B1"
                    sub="каб. 3 · Смирнова А."
                    badge="Отмечено"
                    badgeStyle={{ background: 'var(--success)', color: '#fff' }}
                    highlighted
                  />
                  <ScheduleRow
                    time="12:30"
                    title="Математика 7 кл."
                    sub="каб. 1 · Иванов П."
                    badge="Отметить"
                    badgeStyle={{
                      background: 'color-mix(in oklch, var(--warning) 16%, transparent)',
                      color: 'var(--warning)',
                    }}
                  />
                  <ScheduleRow
                    time="15:00"
                    title="Подготовка к ОГЭ"
                    sub="каб. 2 · Петрова М."
                    badge="Отметить"
                    badgeStyle={{
                      background: 'color-mix(in oklch, var(--warning) 16%, transparent)',
                      color: 'var(--warning)',
                    }}
                  />
                </div>
              </div>
              <div>
                <FeatureIconBox>
                  <CalendarCheck size={24} />
                </FeatureIconBox>
                <h3 style={featureTitle}>Расписание и посещаемость в пару кликов</h3>
                <p style={featureText}>
                  Визуальный календарь уроков, отметка посещаемости в один тап и удобные отработки
                  пропущенных занятий. Баланс уроков списывается автоматически.
                </p>
                <FeatureList
                  items={[
                    'Отметка посещаемости за секунды',
                    'Отработки пропущенных занятий',
                    'Автосписание с баланса уроков',
                  ]}
                />
              </div>
            </Reveal>

            {/* Сетка из 4 карточек */}
            <Reveal
              className="eduda-fgrid"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}
            >
              {[
                {
                  title: 'Умная лента',
                  text: 'Сама показывает, где не отмечена посещаемость, у кого заканчивается баланс и кто пропускает уроки подряд.',
                  Icon: Bell,
                },
                {
                  title: 'Кабинет родителя',
                  text: 'Персональная ссылка: родитель видит всех своих детей, посещаемость, финансы и расписание.',
                  Icon: Users,
                },
                {
                  title: 'Монеты и магазин',
                  text: 'Внутренняя валюта за активность и магазин, где её можно потратить. Геймификация повышает вовлечённость.',
                  Icon: Coins,
                },
                {
                  title: 'Роли и доступы',
                  text: 'Владелец, менеджер, преподаватель — каждый видит только своё. Отдельный поддомен под каждую школу.',
                  Icon: Shield,
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="eduda-fcard"
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    background: 'var(--card)',
                    boxShadow: 'var(--ring-card)',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 11,
                      background: 'color-mix(in oklch, var(--primary) 12%, transparent)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <c.Icon size={22} />
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{c.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--muted-foreground)' }}>
                    {c.text}
                  </p>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {/* ===== КАК ЭТО РАБОТАЕТ ===== */}
        <section id="how">
          <Reveal style={{ ...container, padding: '80px 24px' }}>
            <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 52px' }}>
              <div style={eyebrow}>Как это работает</div>
              <h2 style={h2}>Запуск за один вечер</h2>
              <p style={lead}>
                Без внедренцев и обучения. Четыре шага — и школа работает в системе.
              </p>
            </div>
            <div
              className="eduda-steps"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }}
            >
              {[
                [
                  'Заведите школу',
                  'Свой поддомен, локации, курсы и преподаватели — за пару минут.',
                ],
                [
                  'Добавьте учеников',
                  'Группы, расписание и карточки учеников. Перенос из Excel поддерживается.',
                ],
                [
                  'Отмечайте уроки и оплаты',
                  'Посещаемость и платежи в пару кликов — балансы обновляются сами.',
                ],
                [
                  'Следите за прибылью',
                  'Выручка, зарплаты, прибыль по месяцам и удержание — на одном экране.',
                ],
              ].map(([title, text], i) => (
                <div key={title} style={{ position: 'relative' }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--primary-foreground)',
                      width: 40,
                      height: 40,
                      borderRadius: 11,
                      background: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 18,
                    }}
                  >
                    {i + 1}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</h3>
                  <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--muted-foreground)' }}>
                    {text}
                  </p>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 44 }}>
              <Link
                href={enterHref}
                className="transition-opacity hover:opacity-90"
                style={primaryCta}
              >
                Начать бесплатно
                <ArrowRight />
              </Link>
            </div>
          </Reveal>
        </section>

        {/* ===== ЦИФРЫ И ОТЗЫВЫ ===== */}
        <section
          style={{
            background: 'var(--muted)',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Reveal style={{ ...container, padding: '72px 24px' }}>
            <div
              className="eduda-stats"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4,1fr)',
                gap: 24,
                marginBottom: 56,
              }}
            >
              {[
                ['***', 'школ на платформе*'],
                ['***', 'уроков отмечено*'],
                ['***', 'рутины в неделю*'],
                ['***', 'оплат под контролем*'],
              ].map(([num, label]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div
                    className="eduda-num"
                    style={{
                      fontSize: 'clamp(30px,4vw,44px)',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      color: 'var(--primary)',
                    }}
                  >
                    {num}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--muted-foreground)', marginTop: 4 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
            <p
              style={{
                textAlign: 'center',
                fontSize: 12,
                color: 'var(--muted-foreground)',
                margin: '-40px 0 40px',
              }}
            >
              * Данные-заглушки — заменить на реальные после запуска.
            </p>

            <div
              className="eduda-testi"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}
            >
              {[
                {
                  text: '«[Отзыв-заглушка] Впервые вижу реальную прибыль школы по месяцам без единой таблицы. Зарплаты считаются сами.»',
                  initials: 'АС',
                  role: 'Владелец языковой школы',
                },
                {
                  text: '«[Отзыв-заглушка] Родители перестали писать в чат — всё видят в личном кабинете. Стало заметно спокойнее.»',
                  initials: 'МП',
                  role: 'Администратор детского клуба',
                },
                {
                  text: '«[Отзыв-заглушка] Монеты и магазин реально держат детей — посещаемость выросла, а отток снизился.»',
                  initials: 'ДК',
                  role: 'Руководитель сети центров',
                },
              ].map((t) => (
                <div
                  key={t.initials}
                  style={{
                    padding: 26,
                    borderRadius: 16,
                    background: 'var(--card)',
                    boxShadow: 'var(--ring-card)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 2, marginBottom: 14 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} />
                    ))}
                  </div>
                  <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 18 }}>{t.text}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'color-mix(in oklch, var(--primary) 14%, transparent)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      {t.initials}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Имя Фамилия</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ===== ТАРИФЫ ===== */}
        <section id="pricing">
          <Reveal style={{ ...container, padding: '80px 24px' }}>
            <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 20px' }}>
              <div style={eyebrow}>Тарифы</div>
              <h2 style={h2}>Простые тарифы под размер школы</h2>
              <p style={lead}>14 дней бесплатно. Без карты. Отмена в любой момент.</p>
            </div>
            <p
              style={{
                textAlign: 'center',
                fontSize: 12,
                color: 'var(--muted-foreground)',
                marginBottom: 36,
              }}
            >
              Цены — заглушки, отредактируйте под свою модель.
            </p>
            <div
              className="eduda-pricing"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3,1fr)',
                gap: 22,
                alignItems: 'stretch',
              }}
            >
              <PricingCard
                name="Старт"
                desc="Для небольшого центра или репетитора"
                price="*** ₽"
                ctaLabel="Начать бесплатно"
                ctaHref={enterHref}
                features={['Возможность 1', 'Возможность 2', 'Возможность 3', 'Возможность 4']}
              />
              <PricingCard
                name="Школа"
                desc="Для растущего учебного центра"
                price="*** ₽"
                ctaLabel="Попробовать бесплатно"
                ctaHref={enterHref}
                featured
                features={['Всё из «Старт»', 'Возможность 1', 'Возможность 2', 'Возможность 3']}
              />
              <PricingCard
                name="Сеть"
                desc="Для сети школ и филиалов"
                price="*** ₽"
                ctaLabel="Обсудить внедрение"
                ctaHref={enterHref}
                features={['Всё из «Школа»', 'Возможность 1', 'Возможность 2', 'Возможность 3']}
              />
            </div>
          </Reveal>
        </section>

        {/* ===== FAQ ===== */}
        <section
          id="faq"
          style={{
            background: 'var(--muted)',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Reveal style={{ maxWidth: 820, margin: '0 auto', padding: '80px 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              <div style={eyebrow}>Вопросы</div>
              <h2 style={{ ...h2, marginBottom: 0 }}>Отвечаем на частые вопросы</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {FAQ.map((item, i) => {
                const open = openFaq === i
                return (
                  <div
                    key={item.q}
                    style={{
                      borderRadius: 14,
                      background: 'var(--card)',
                      boxShadow: 'var(--ring-card)',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => setOpenFaq(open ? -1 : i)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        padding: '18px 20px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        color: 'var(--foreground)',
                        fontSize: 16,
                        fontWeight: 600,
                      }}
                    >
                      {item.q}
                      <ChevronDown
                        size={20}
                        color="var(--muted-foreground)"
                        style={{
                          flex: 'none',
                          transition: 'transform .25s ease',
                          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      />
                    </button>
                    {open && (
                      <div
                        style={{
                          padding: '0 20px 20px',
                          fontSize: 15,
                          lineHeight: 1.65,
                          color: 'var(--muted-foreground)',
                        }}
                      >
                        {item.a}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Reveal>
        </section>

        {/* ===== ФИНАЛЬНЫЙ CTA ===== */}
        <section
          id="cta"
          style={{ position: 'relative', overflow: 'hidden', background: 'var(--primary)' }}
        >
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5 }}>
            <div
              style={{
                position: 'absolute',
                top: -80,
                right: -40,
                width: 340,
                height: 340,
                borderRadius: '50%',
                background: 'rgba(255,255,255,.14)',
                filter: 'blur(70px)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: -100,
                left: -60,
                width: 340,
                height: 340,
                borderRadius: '50%',
                background: 'rgba(255,255,255,.1)',
                filter: 'blur(70px)',
              }}
            />
          </div>
          <Reveal
            style={{
              position: 'relative',
              maxWidth: 820,
              margin: '0 auto',
              padding: '88px 24px',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontSize: 'clamp(30px,4.4vw,50px)',
                lineHeight: 1.08,
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: 'var(--primary-foreground)',
                marginBottom: 18,
              }}
            >
              Наведите порядок в школе
              <br />
              уже на этой неделе
            </h2>
            <p
              style={{
                fontSize: 18,
                lineHeight: 1.6,
                color: 'color-mix(in oklch, var(--primary-foreground) 88%, transparent)',
                maxWidth: 540,
                margin: '0 auto 30px',
              }}
            >
              14 дней бесплатно, без карты. Перенесём ваши данные из Excel — начните с полной
              картины по деньгам.
            </p>
            <Link
              href={enterHref}
              className="transition-opacity hover:opacity-90"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 9,
                background: 'var(--primary-foreground)',
                color: 'var(--primary)',
                fontWeight: 700,
                fontSize: 17,
                padding: '16px 32px',
                borderRadius: 13,
                boxShadow: '0 10px 30px -8px rgba(0,0,0,.4)',
              }}
            >
              Попробовать бесплатно
              <ArrowRight size={19} strokeWidth={2.2} />
            </Link>
          </Reveal>
        </section>

        {/* ===== FOOTER ===== */}
        <footer style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
          <div style={{ ...container, padding: '56px 24px 28px' }}>
            <div
              className="eduda-footgrid"
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                gap: 32,
                marginBottom: 40,
              }}
            >
              <div>
                <a
                  href="#top"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: 'var(--foreground)',
                    marginBottom: 14,
                  }}
                >
                  <Logo className="text-primary" style={{ width: 28, height: 28 }} />
                  <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '.02em' }}>
                    ЕДУДА
                  </span>
                </a>
                <p
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    color: 'var(--muted-foreground)',
                    maxWidth: 280,
                  }}
                >
                  CRM для учебного центра: ученики, расписание, деньги и мотивация в одной системе.
                </p>
              </div>
              <FooterCol
                title="Продукт"
                links={[
                  ['Возможности', '#features'],
                  ['Как это работает', '#how'],
                  ['Тарифы', '#pricing'],
                  ['FAQ', '#faq'],
                ]}
              />
              <FooterCol
                title="Контакты"
                links={[
                  ['hello@eduda.online', 'mailto:hello@eduda.online'],
                  ['+7 000 000-00-00', 'tel:+70000000000'],
                  ['Telegram-поддержка', '#'],
                ]}
              />
              <FooterCol
                title="Правовое"
                links={[
                  ['Политика конфиденциальности', '#'],
                  ['Публичная оферта', '#'],
                ]}
              />
            </div>
            <div
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: 22,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>
                © 2026 ЕДУДА. Все права защищены.
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>
                Сделано для учебных центров, языковых школ и детских клубов.
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}

/* ─── Вспомогательные компоненты ─────────────────────────────────────────── */

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // До монтирования тема неизвестна — показываем солнце, чтобы SSR и клиент совпадали.
  const isDark = mounted && resolvedTheme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Переключить тему"
      className="hover:bg-muted transition-colors"
      style={{
        width: 38,
        height: 38,
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--border)',
        background: 'var(--background)',
        borderRadius: 10,
        color: 'var(--muted-foreground)',
      }}
    >
      {isDark ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  )
}

const featureTitle: CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  marginBottom: 14,
}
const featureText: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.65,
  color: 'var(--muted-foreground)',
  marginBottom: 20,
}
const mockCard: CSSProperties = {
  borderRadius: 16,
  background: 'var(--card)',
  boxShadow: 'var(--ring-card),var(--shadow-popover)',
  padding: 18,
}

function FeatureIconBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: 'color-mix(in oklch, var(--primary) 12%, transparent)',
        color: 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
      }}
    >
      {children}
    </div>
  )
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {items.map((t) => (
        <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14.5 }}>
          <CheckIcon />
          {t}
        </li>
      ))}
    </ul>
  )
}

function ScheduleRow({
  time,
  title,
  sub,
  badge,
  badgeStyle,
  highlighted,
}: {
  time: string
  title: string
  sub: string
  badge: string
  badgeStyle: CSSProperties
  highlighted?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: 10,
        background: highlighted
          ? 'color-mix(in oklch, var(--primary) 8%, transparent)'
          : 'var(--muted)',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--muted-foreground)', width: 38 }}>{time}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{sub}</div>
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          padding: '3px 7px',
          borderRadius: 9999,
          ...badgeStyle,
        }}
      >
        {badge}
      </span>
    </div>
  )
}

function PricingCard({
  name,
  desc,
  price,
  ctaLabel,
  ctaHref,
  features,
  featured,
}: {
  name: string
  desc: string
  price: string
  ctaLabel: string
  ctaHref: string
  features: string[]
  featured?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 28,
        borderRadius: 18,
        background: 'var(--card)',
        position: 'relative',
        boxShadow: featured
          ? '0 0 0 2px var(--primary),0 24px 48px -18px color-mix(in oklch, var(--primary) 42%, transparent)'
          : 'var(--ring-card)',
      }}
    >
      {featured && (
        <span
          style={{
            position: 'absolute',
            top: -13,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            fontSize: 11,
            fontWeight: 600,
            padding: '5px 14px',
            borderRadius: 9999,
          }}
        >
          Рекомендуем
        </span>
      )}
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{name}</div>
      {/* minHeight держит цену, кнопку и список фич на одной высоте во всех
          трёх колонках — описания разной длины иначе разъезжаются. */}
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--muted-foreground)',
          marginBottom: 18,
          minHeight: 39,
        }}
      >
        {desc}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
        <span
          className="eduda-num"
          style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em' }}
        >
          {price}
        </span>
        <span style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>/ мес</span>
      </div>
      <Link
        href={ctaHref}
        className={
          featured ? 'transition-opacity hover:opacity-90' : 'hover:bg-muted transition-colors'
        }
        style={{
          display: 'block',
          textAlign: 'center',
          fontWeight: 600,
          fontSize: 15,
          padding: 12,
          borderRadius: 11,
          marginBottom: 22,
          ...(featured
            ? {
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                boxShadow: 'var(--shadow-cta)',
              }
            : {
                background: 'var(--background)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }),
        }}
      >
        {ctaLabel}
      </Link>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 11,
        }}
      >
        {features.map((f) => (
          <li key={f} style={{ display: 'flex', gap: 9, fontSize: 14 }}>
            <CheckIcon size={17} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {links.map(([label, href]) =>
          // Страницы ещё нет — показываем текстом, а не ссылкой в никуда.
          href === '#' ? (
            <span
              key={label}
              title="Скоро"
              style={{ fontSize: 13.5, color: 'var(--muted-foreground)', opacity: 0.6 }}
            >
              {label}
            </span>
          ) : (
            <a
              key={label}
              href={href}
              className="hover:text-foreground transition-colors"
              style={{ fontSize: 13.5, color: 'var(--muted-foreground)' }}
            >
              {label}
            </a>
          ),
        )}
      </div>
    </div>
  )
}
