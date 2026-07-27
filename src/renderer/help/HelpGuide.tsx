import type { ReactElement } from "react";
import { helpSections } from "./helpContent";

export function HelpGuide(): ReactElement {
  return (
    <article className="help-guide" aria-label="Help Guide">
      <aside className="help-guide-sidebar" aria-label="Help sections">
        <div className="help-guide-sidebar-title">Contents</div>
        <nav>
          {helpSections.map((section) => (
            <a key={section.id} href={`#help-${section.id}`}>
              {section.title}
            </a>
          ))}
        </nav>
      </aside>
      <div className="help-guide-scroll">
        <div className="help-guide-reading-column">
          <header className="help-guide-hero">
            <div className="eyebrow">HELP</div>
            <h1>DITBrowse Help Guide</h1>
            <p>Camera setup and passwords</p>
          </header>
          {helpSections.map((section) => (
            <section
              key={section.id}
              id={`help-${section.id}`}
              className="help-guide-section"
            >
              <h2>{section.title}</h2>
              <p>{section.introduction}</p>
              {section.steps && (
                <ol>
                  {section.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              )}
              {section.notes && (
                <div className="help-guide-notes">
                  {section.notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              )}
              {section.controlGroups && (
                <div
                  className="help-control-reference"
                  aria-label="Main Page Controls reference"
                >
                  {section.controlGroups.map((group) => (
                    <section key={group.title} className="help-control-group">
                      <h3>{group.title}</h3>
                      <dl>
                        {group.controls.map((control) => (
                          <div key={control.label} className="help-control-row">
                            <dt>{control.label}</dt>
                            <dd>
                              <p>{control.outcome}</p>
                              <span>{control.scope}</span>
                              {control.availability && <small>{control.availability}</small>}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ))}
                </div>
              )}
              {section.images?.map((image) => (
                <figure key={image.src} className="help-figure">
                  <img src={image.src} alt={image.alt} />
                  <figcaption>
                    <p>{image.caption}</p>
                    <ol className="help-callouts">
                      {image.callouts.map((callout) => (
                        <li
                          key={callout.number}
                          className={callout.destructive ? "destructive" : undefined}
                        >
                          <span className="help-callout-number" aria-hidden="true">
                            {callout.number}
                          </span>
                          <span>{callout.text}</span>
                        </li>
                      ))}
                    </ol>
                  </figcaption>
                </figure>
              ))}
              {section.troubleshooting?.map((item) => (
                <article key={item.symptom} className="help-troubleshooting-item">
                  <h3>{item.symptom}</h3>
                  <p>
                    <strong>Likely cause:</strong> {item.cause}
                  </p>
                  <p>
                    <strong>Fix:</strong> {item.action}
                  </p>
                </article>
              ))}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
