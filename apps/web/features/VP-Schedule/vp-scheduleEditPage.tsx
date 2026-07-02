import { VPScheduleForm } from "./vp-scheduleForm";


type Props = {
  scheduleId: string;
};

export function VPScheduleEditPage({ scheduleId }: Props) {
  return (
    <VPScheduleForm
      mode="edit"
      scheduleId={scheduleId}
    />
  );
}