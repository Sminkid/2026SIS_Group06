import type {
  UsydCommencement,
  UsydPlanStreamGroup,
} from "../../../domain/usydStudyPlan";

interface Props {
  groups: UsydPlanStreamGroup[];
  stream: string;
  commencement: UsydCommencement | "";
  planId: string;
  onStreamChange: (stream: string) => void;
  onCommencementChange: (commencement: UsydCommencement) => void;
  onPlanChange: (planId: string) => void;
}

export const UsydEngineeringPlanSelector = ({
  groups,
  stream,
  commencement,
  planId,
  onStreamChange,
  onCommencementChange,
  onPlanChange,
}: Props) => {
  const streamGroup = groups.find((group) => group.pathway === stream);
  const commencementGroup = streamGroup?.commencements.find(
    (group) => group.id === commencement,
  );

  return (
    <div
      className="grid max-w-3xl gap-5 border border-solid border-slate-300 bg-white p-5"
      aria-label="USYD Engineering study plan selection"
    >
      <label className="grid gap-2 text-sm font-bold">
        <span>Engineering stream</span>
        <select value={stream} onChange={(event) => onStreamChange(event.target.value)}>
          <option value="">Choose an Engineering stream</option>
          {groups.map((group) => (
            <option value={group.pathway} key={group.pathway}>
              {group.pathway}
            </option>
          ))}
        </select>
      </label>
      {streamGroup && (
        <label className="grid gap-2 text-sm font-bold">
          <span>Commencement</span>
          <select
            value={commencement}
            onChange={(event) => onCommencementChange(event.target.value as UsydCommencement)}
          >
            <option value="">Choose commencement</option>
            {streamGroup.commencements.map((group) => (
              <option value={group.id} key={group.id}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {commencementGroup && (
        <label className="grid gap-2 text-sm font-bold">
          <span>Official plan variant</span>
          <select value={planId} onChange={(event) => onPlanChange(event.target.value)}>
            <option value="">Choose an official plan</option>
            {commencementGroup.variants.map((item) => (
              <option value={item.plan.id} key={item.plan.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
};
