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
          <h2>Team contribution matrix</h2>
          <ul>
            <li><strong>Subigya Subedi:</strong> lung CT classification, Grad-CAM integration, and React frontend development.</li>
            <li><strong>Divyanshu Sharma:</strong> API development and dataset collection and organization.</li>
            <li><strong>Atharv Gangodkar:</strong> brain-stroke CT classification workstream.</li>
            <li><strong>Sufiyaan Ahmed:</strong> research activities, method investigation, and solution-finding for development problems.</li>
          </ul>
        </section>
        <section className="about-section">
          <h2>Shared responsibilities</h2>
          <ul>
            <li>System integration across the frontend, API, and image models.</li>
            <li>Functional testing and demonstration preparation.</li>
            <li>Documentation, final report preparation, and presentation.</li>
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
