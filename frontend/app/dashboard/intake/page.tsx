import { IntakeWizard } from "@/components/intake/IntakeWizard"

export default function IntakePage() {
    return (
        <>
            <div className="mb-10">
                <h1 className="text-3xl md:text-4xl font-bold mb-2 text-white">New Video Intake</h1>
                <p className="text-vca-text-secondary text-lg">Generate cryptographic proofs and digitally seal your content.</p>
            </div>
            <IntakeWizard />
        </>
    )
}
