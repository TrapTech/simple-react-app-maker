# simple-react-app-maker

This npm package is a collection of extremely simple scripts, intended for
super-fast building of React applications.

Thanks to the usage
of [esbuild](https://esbuild.github.io/), it achieves _very fast_ build times.

It tries to be _mostly_ compatible with Create React App. 

## Usage

Install with:

```bash
$ npm install -D simple-react-app-maker
```

Make sure `react` packages are installed:
```bash
$ npm install react react-dom
```

Make sure your project has the following:

- A public folder, with at least an `index.html` file.
    - Replacement of `%PUBLIC_URL%` is supported

- A `src/index.tsx` file with the React entrypoint.
    - You can define different entrypoints, see the configuration section below.

- A `csp.js` file, containing configuration for CSP according to [react-csp](https://www.npmjs.com/package/react-csp)

Then, you can run one of the following scripts:

- `npx simple-react-server` - creates a development server. Your application is available under `localhost:3000`.
    Note that for simplicity, the devserver _does not_ support live reload. To see changes, refresh the page in the browser.

- `npx simple-react-publish` - builds your application to the `build/dist/` folder.

## Configuration

The scripts can be configured using `package.json` fields.

Some configuration options are controlled by the `NODE_ENV` environment variable.
If the variable is not defined, `development` is assumed.

- `homepage` - defines the root url of the application. If not defined, assumes `/`.

- `browserslist.development` - defines [browserslist]() values for the development application build.
    This is passed to esbuild to control what features should be shimmed, etc. Note that esbuild cannot
    generate ES5 output, only ES6 - therefore, too broad browserslist will cause build to fail.

- `browserslist.production` - same as above, but used when `NODE_ENV=production`.

- `externalFiles.development`, `externalFiles.production` - can be set to an array of files. These files
    will be excluded from the final build output.

- `entrypoints` - can be set to an array of files that are entrypoints for the esbuild process. By default `["src/index.tsx"]`.

