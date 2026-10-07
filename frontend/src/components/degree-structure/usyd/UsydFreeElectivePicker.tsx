import type { RequirementCandidateSourceSummary } from "../../../types/handbook";
import { RequirementCandidateSubjectBrowser } from "../RequirementCandidateSubjectBrowser";

interface Props {
  candidateSources: RequirementCandidateSourceSummary[];
  onOpenSubject: (subjectCode: string) => void;
}

export const UsydFreeElectivePicker = (props: Props) => <RequirementCandidateSubjectBrowser {...props}
  heading="Eligible Free Elective subjects"
  description="Eligibility is the union of these sources. Subjects found in both are shown once."
  sourcesLabel="Free Elective eligibility sources"
  searchLabel="Search eligible subjects by code or name"
  searchPlaceholder="For example, COMP or accounting"
  searchButtonLabel="Search eligible subjects"
  loadingLabel="Loading eligible Free Elective subjects"
  errorLabel="We couldn't load eligible Free Elective subjects." />;
