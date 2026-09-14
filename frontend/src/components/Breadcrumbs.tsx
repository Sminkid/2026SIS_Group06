import { appUi } from "./ui";
interface BreadcrumbsProps { items: Array<{ label: string; onClick?: () => void }>; }

/** Renders keyboard-accessible navigation with a noninteractive current location. */
export const Breadcrumbs = ({ items }: BreadcrumbsProps) => (
  <nav className={appUi.breadcrumbs} aria-label="Breadcrumb">
    <ol>
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`}>
          {item.onClick ? <button type="button" onClick={item.onClick}>{item.label}</button> : <span aria-current="page">{item.label}</span>}
        </li>
      ))}
    </ol>
  </nav>
);
