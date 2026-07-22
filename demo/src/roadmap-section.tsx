import { groupRoadmapItems, roadmapPhases } from './roadmap';

export function RoadmapSection() {
  const groups = groupRoadmapItems();

  return (
    <section className="roadmap" id="roadmap" aria-labelledby="roadmap-title">
      <div className="roadmap__intro">
        <div>
          <p className="demo-kicker">Product direction</p>
          <h2 id="roadmap-title">Product roadmap</h2>
        </div>
        <p>
          Template printing and document generation come first. Priorities show capability dependencies,
          not promised release dates.
        </p>
      </div>

      <div className="roadmap__phases">
        {roadmapPhases.map(phase => (
          <article className="roadmap-phase" key={phase.id} aria-labelledby={`roadmap-phase-${phase.id}`}>
            <header>
              <span className="roadmap-phase__number">Phase {phase.id}</span>
              <p>{phase.label}</p>
              <h3 id={`roadmap-phase-${phase.id}`}>{phase.title}</h3>
              <p>{phase.summary}</p>
            </header>
            <ol className="roadmap-phase__items">
              {groups.get(phase.id)?.map(roadmapItem => (
                <li key={roadmapItem.id}>
                  <div className="roadmap-item__status">
                    <span aria-hidden="true" />
                    Planned
                  </div>
                  <a href={roadmapItem.designHref}>{roadmapItem.title}</a>
                  <p>{roadmapItem.summary}</p>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}
