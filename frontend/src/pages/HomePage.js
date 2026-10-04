import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/research.css';

const modules = [
  {
    icon: '🫁',
    title: 'Lung CT Classification',
    description: 'MobileNetV2 classifies one rendered axial lung CT slice as normal, benign, or malignant.',
    link: '/imaging',
    action: 'Analyze a scan',
  },
  {
    icon: '🧠',
    title: 'Stroke-Pattern Classification',
    description: 'EfficientNetV2B0 classifies one rendered non-contrast head CT slice into three research classes.',
    link: '/imaging?mode=stroke',
    action: 'Analyze a scan',
  },
];

function HomePage() {
  return (
    <div className="research-shell">
      <header className="research-nav">
        <Link className="research-brand" to="/">CureNet</Link>
        <nav>
          <Link to="/imaging">Medical imaging</Link>
          <Link to="/methodology">Methodology</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>

      <main>
        <section className="research-hero">
          <p className="research-eyebrow">Final-year computer engineering research project</p>
          <h1>Computer vision for lung CT and brain-stroke image analysis.</h1>
          <p className="research-lead">
            CureNet combines anatomy-aware CT routing, lung and brain-stroke
            classifiers, and Grad-CAM attention visualization in one reproducible
            medical-image research prototype.
          </p>
          <div className="research-warning">
            Research and education only. CureNet is not a medical device and does not provide diagnoses or treatment advice.
          </div>
        </section>

        <section className="research-module-grid" aria-label="Research modules">
          {modules.map((module) => (
            <article className="research-module-card" key={module.title}>
              <span className="research-module-icon" aria-hidden="true">{module.icon}</span>
              <h2>{module.title}</h2>
              <p>{module.description}</p>
              <Link to={module.link}>{module.action} →</Link>
            </article>
          ))}
        </section>

        <section className="research-flow">
          <div>
            <p className="research-eyebrow">Research focus</p>
            <h2>Fail closed before making a prediction</h2>
          </div>
          <ol>
            <li>Validate file structure and radiological-image characteristics.</li>
            <li>Route supported head and lung CT slices with an anatomy gate.</li>
            <li>Run the matching classifier and expose every class score.</li>
            <li>Return limitations, model version, and non-diagnostic warnings.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}

export default HomePage;
