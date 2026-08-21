interface BreadcrumbsProps { items: Array<{ label: string; onClick?: () => void }>; }

export const Breadcrumbs = ({ items }: BreadcrumbsProps) => (
  <nav className="breadcrumbs" aria-label="Breadcrumb">
    <ol>
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`}>
          {item.onClick ? <button type="button" onClick={item.onClick}>{item.label}</button> : <span aria-current="page">{item.label}</span>}
        </li>
      ))}
    </ol>
  </nav>
);
