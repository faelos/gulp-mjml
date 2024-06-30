const edmPath = 'src/example-client/my-edm'

import gulp from 'gulp'
import rename from 'gulp-rename'
import through from 'through2'
import open from 'open';
import mjml from 'mjml'
import liveServer from 'live-server'
import imagemin from 'gulp-imagemin'
import zip from 'gulp-zip'
import captureWebsite from 'capture-website'
import hb from 'gulp-hb'
import _ from 'lodash'
import fs from 'fs'
import { deleteAsync } from 'del';

let isDist = false
const archiveData = []

gulp.task('serve', (done) => {
  var params = {
    port: 8080,
    host: '127.0.0.1',
    root: './build',
    open: !isDist,
    wait: 400,
    logLevel: 0,
  }
  liveServer.start(params)
  done()
})

gulp.task('serve-stop', (done) => {
  liveServer.shutdown()
  done()
})

gulp.task('mjml', () => {
  return gulp
    .src([`${edmPath}/*.mjml`])
    .pipe(
      through.obj(function (file, enc, callback) {
        const output = file.clone()

        const mjmlOpts = {
          filePath: `${edmPath}/`,
          validationLevel: isDist ? 'strict' : 'soft',
          minify: isDist,
        }

        const render = mjml(file.contents.toString(), mjmlOpts)
        if (render?.errors.length) console.log(render.errors)
        output.contents = Buffer.from(render.html)
        this.push(output)
        return callback()
      }),
    )
    .pipe(
      rename(function (path) {
        path.extname = '.html'
      }),
    )
    .pipe(gulp.dest('./build'))
})

gulp.task('imagemin', () => {
  return gulp
    .src(`${edmPath}/img/*`)
    .pipe(imagemin())
    .pipe(gulp.dest('build/img'))
})

gulp.task('zip', () => {
    return gulp.src('build/**')
		.pipe(zip('edm.zip'))
		.pipe(gulp.dest('dist'))
})

gulp.task('watch', () => {
  gulp.watch('src/**/*.mjml', gulp.task('mjml'))
  gulp.watch(`${edmPath}/img/*`, gulp.task('imagemin'))
})

gulp.task('screenshots', () => {
  const opts = {
    fullPage: true,
    overwrite: true,
    scaleFactor: 1,
    type: 'webp',
    quality: 0.8
  }
  return Promise.all([
    captureWebsite.file('http://localhost:8080', `${edmPath}/screenshot-600.webp`, {
      ...opts,
      width: 600
    }),
    captureWebsite.file('http://localhost:8080', `${edmPath}/screenshot-375.webp`, {
      ...opts,
      width: 375
    })
  ])
})

gulp.task('copy-build-dist', () => {
  return gulp.src('build/**')
    .pipe(gulp.dest('dist'))
})


gulp.task('clone-new', (done) => {
  if (!fs.existsSync(`${edmPath}/`)) {
    console.log(`cloning src/new-template @ ${edmPath}`)
    return gulp.src(`src/new-template/**/*`)
      .pipe(gulp.dest(`${edmPath}/`))
  } else {
    done()
  }
})

gulp.task('archive-data', () => {
  return gulp.src('./src/**/screenshot-600.webp')
    .pipe(
      through.obj(function (file, enc, callback) {
        const path = `../src${file.path.split('src')[1].replace(/\\/g, '/').replace('screenshot-600.webp', '')}`
        const client = path.split('/')[2]
        const campaign = path.split(client)[1].replace('/', '')

        archiveData.push({
          client,
          campaign,
          path,
          screenshot600: `${path}screenshot-600.webp`,
          screenshot375: `${path}screenshot-375.webp`
        })
        return callback()
      })
    )
})

gulp.task('archive-build', () => {
  
  const data = _(archiveData)
    .sortBy(['client', 'campaign'])
    .groupBy('client')
    .value()

  // note: {{log this}} in hbs will output to terminal

  return gulp.src('./archive/index.hbs')
    .pipe(hb({
      data: {
        clients: data
      }
    }))
    .pipe(rename('index.html'))
    .pipe(gulp.dest('./archive'))
})

gulp.task('open-archive', (done) => {
  open('archive/index.html')
  done()
})

gulp.task('clean', function(){
  return deleteAsync(['build/**', 'dist/**'], { force:true });
});

gulp.task('dist', (done) => {
  isDist = true
  return gulp.series('mjml', 'imagemin', 'serve', 'zip', 'copy-build-dist', 'screenshots', 'serve-stop')(done)
})

gulp.task('default', gulp.series(gulp.parallel('clean', 'clone-new'), gulp.parallel('mjml', 'imagemin'), gulp.parallel('watch', 'serve')))

gulp.task('build', gulp.series('mjml'))

gulp.task('archive', gulp.series('archive-data', 'archive-build', 'open-archive'))