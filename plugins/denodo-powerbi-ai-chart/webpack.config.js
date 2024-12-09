const path = require('path');

module.exports = {
  mode: 'development', // Set to 'production' for production builds
  entry: './src/visual.ts', // Entry point of your TypeScript file
  output: {
    filename: 'bundle.js', // Output file name
    path: path.resolve(__dirname, 'dist'), // Output directory
  },
  module: {
    rules: [
      {
        test: /\.ts$/, // Use ts-loader for TypeScript files
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.(png|jpe?g|gif)$/i, // For image files
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]', // Retain original name and extension
              outputPath: 'assets', // Output images to the 'dist/assets' folder
            },
          },
        ],
      },
      {
        test: /\.less$/, // For LESS files
        use: [
          'style-loader', // Injects CSS into the DOM
          'css-loader', // Turns CSS into JavaScript
          'less-loader', // Compiles LESS to CSS
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'], // Resolve TypeScript and JavaScript files
  },
};
