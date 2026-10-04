import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/research.css';

function AboutPage() {
  return (
    <div className="research-shell">
      <header className="research-nav">
        <Link className="research-brand" to="/">CureNet</Link>
        <nav><Link to="/imaging">Imaging</Link><Link to="/methodology">Methodology</Link></nav>
      </header>
      <main className="research-content narrow-content">
        <p className="research-eyebrow">Project and contribution scope</p>
        <h1>A collaborative final-year project</h1>
        <p className="research-lead">
          CureNet was developed by a computer-engineering student team. Work was divided by module and integrated into a shared research prototype.
        </p>
        <section className="about-section">
          <h2>Primary contribution represented in this portfolio</h2>
          <ul>
            <li>Lung CT classification using MobileNetV2 transfer learning.</li>
            <li>Grad-CAM attention visualization for the lung classifier.</li>
            <li>React interface and user-facing research workflows.</li>
            <li>Integration of the imaging interface with the ML inference API.</li>
          </ul>
        </section>
        <section className="about-section">
          <h2>Collaborative team components</h2>
          <ul>
            <li>Brain-stroke CT classification was led by another team member.</li>
            <li>Node/Express APIs in the original project were led by another team member.</li>
            <li>System integration, testing, and documentation were collaborative.</li>
          </ul>
        </section>
        <section className="research-warning">
          Dataset limitations, slice-level evaluation, and the lack of prospective clinical validation prevent clinical use of this software.
        </section>
      </main>
    </div>
  );
}

export default AboutPage;
