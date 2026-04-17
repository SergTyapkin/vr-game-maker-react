import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // turbopack: false,
  //
  // webpack(config, options) {
  //   // Добавляем правило для .styl файлов
  //   config.module.rules.push({
  //     test: /\.styl$/,
  //     use: [
  //       options.defaultLoaders.babel, // Поддержка импорта из JS/TS файлов
  //       {
  //         loader: 'stylus-loader',
  //         options: {
  //           stylusOptions: {
  //             // Здесь можно указать плагины Stylus, например:
  //             // use: [require('nib')()],
  //             // import: ['nib'],
  //           },
  //         },
  //       },
  //     ],
  //   });
  //
  //   // Правило для CSS-модулей Stylus (файлы .module.styl)
  //   config.module.rules.push({
  //     test: /\.module\.styl$/,
  //     use: [
  //       options.defaultLoaders.babel,
  //       {
  //         loader: 'stylus-loader',
  //         options: {
  //           stylusOptions: {
  //             // Опции компилятора
  //           },
  //         },
  //       },
  //       {
  //         loader: 'css-loader',
  //         options: {
  //           modules: {
  //             localIdentName: '[local]_[hash:base64:5]',
  //           },
  //           importLoaders: 1,
  //         },
  //       },
  //     ],
  //   });
  //
  //   return config;
  // },
};

export default nextConfig;
