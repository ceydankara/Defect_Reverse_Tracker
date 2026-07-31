import 'zone.js'; // <-- En üst satıra bu satırı ekleyin
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app'; // ya da uygulamanızın ana bileşeni

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
