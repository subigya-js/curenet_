import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/research.css';

const modelCards = [
  {
    title: 'Lung CT module',
    architecture: 'MobileNetV2 transfer learning',
    input: 'One rendered axial lung CT slice (PNG/JPEG)',
    output: 'normal · benign · malignant',
    note: 'Slice-level research classification. Grad-CAM displays model attention, not a lesion boundary.',
  },
  {
    title: 'Brain-stroke module',
    architecture: 'EfficientNetV2B0 transfer learning',
    input: 'One rendered non-contrast head CT slice (PNG/JPEG)',
    output: 'no stroke · ischemic stroke · hemorrhagic stroke',
    note: 'Experimental slice-level pattern classification; it cannot replace full-study radiology review.',
  },
  {
    title: 'Anatomy gate',
    architecture: 'Three-class image router with abstention thresholds',
    input: 'Rendered medical or unsupported image',
    output: 'head CT · lung CT · unsupported',
    note: 'Rejects uncertain, unsupported, and anatomy-mismatched inputs before disease classification.',
  },
];

function MethodologyPage() {
  return (
    <div className="research-shell">
      <header className="research-nav">
        <Link className="research-brand" to="/">CureNet</Link>
        <nav><Link to="/imaging">Imaging</Link><Link to="/about">About</Link></nav>
      </header>
      <main className="research-content">
        <p className="research-eyebrow">Methods and model contracts</p>
        <h1>What each module actually does</h1>
        <p className="research-lead">The project uses explicit input and output contracts so saved artifacts cannot silently change class order or preprocessing.</p>
        <section className="method-grid">
          {modelCards.map((card) => (
            <article className="method-card" key={card.title}>
              <h2>{card.title}</h2>
              <dl>
                <dt>Method</dt><dd>{card.architecture}</dd>
                <dt>Supported input</dt><dd>{card.input}</dd>
                <dt>Output</dt><dd>{card.output}</dd>
              </dl>
              <p>{card.note}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

export default MethodologyPage;
