/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './index.html',
        './*.js',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                comic: ['"Bangers"', 'cursive'],
            },
            colors: {
                spider: {
                    red: '#E62429',
                    darkred: '#A81219',
                    blue: '#1A4C8B',
                    lblue: '#2B6CB0',
                    yellow: '#FFD23F',
                    ink: '#0B0E1A',
                    web: '#F5F5F5',
                }
            }
        }
    },
    plugins: [],
};
