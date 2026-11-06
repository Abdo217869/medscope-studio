import { render } from 'preact';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/geist-mono/600.css';

// Phase 7b: Self-hosted Canva design fonts (Fredoka, Arimo, Lilita One, Poppins, Grand Hotel)
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/arimo/400.css';
import '@fontsource/arimo/700.css';
import '@fontsource/lilita-one/400.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import '@fontsource/grand-hotel/400.css';

import { App } from './App';
import './index.css';

render(<App />, document.getElementById('app'));
