import { MRRRForm } from "./mrrrForm";


type Props = {
    mrrrId: string;
};

export function MRRREditPage({ mrrrId }: Props) {
    return (
        <MRRRForm
            mode="edit"
            mrrrId={mrrrId}
        />
    );
}