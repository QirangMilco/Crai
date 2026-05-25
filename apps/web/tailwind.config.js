/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // 设计 Token 在 CSS 变量中定义
      // Tailwind 类名通过 CSS 变量引用
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
