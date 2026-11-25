import type { AnatomyAtlas } from '../types/anatomy';

export const ANATOMY_ATLASES: AnatomyAtlas[] = [
  {
    id: 'heart',
    title: 'Human Heart — Anterior 3D Cutaway',
    shortName: 'Human Heart',
    system: 'Cardiovascular System',
    summary:
      'Interactive 3D anatomical heart cutaway highlighting chambers, valves, great vessels, myocardium, and clinical landmarks.',
    imageUrl: '/src/assets/images/anatomy_heart_3d_1795591454347.jpg',
    pins: [
      // Left Column (6 critical structures)
      {
        id: 'superior_vena_cava',
        label: 'Superior Vena Cava',
        category: 'vessel',
        side: 'left',
        x: 32,
        y: 23,
        description:
          'Large low-pressure systemic vein returning deoxygenated blood from the head, neck, upper limbs, and thorax directly into the right atrium.',
        clinicalNote:
          'Compression by lung tumors or mediastinal masses causes Superior Vena Cava (SVC) syndrome with facial/neck venous engorgement.',
      },
      {
        id: 'right_pulmonary_artery',
        label: 'Right Pulmonary Artery',
        category: 'vessel',
        side: 'left',
        x: 26,
        y: 30,
        description:
          'Passes horizontally posterior to the ascending aorta and superior vena cava to deliver deoxygenated blood to the right lung.',
        clinicalNote:
          'Saddle pulmonary emboli can lodge at the pulmonary bifurcation and acutely obstruct right ventricular outflow.',
      },
      {
        id: 'right_atrium',
        label: 'Right Atrium',
        category: 'chamber',
        side: 'left',
        x: 31,
        y: 49,
        description:
          'Thin-walled upper right chamber receiving systemic venous return from the SVC, IVC, and coronary sinus; houses the SA pacemaker node.',
        clinicalNote:
          'Enlarges in tricuspid regurgitation or pulmonary hypertension, producing peaked P waves ("P pulmonale") on ECG.',
      },
      {
        id: 'tricuspid_valve',
        label: 'Tricuspid Valve',
        category: 'valve',
        side: 'left',
        x: 37,
        y: 63,
        description:
          'Three-leaflet right atrioventricular valve anchored by chordae tendineae and papillary muscles to prevent backflow during systole.',
        clinicalNote:
          'Best auscultated at the left lower sternal border; classically affected in right-sided infective endocarditis.',
      },
      {
        id: 'right_ventricle',
        label: 'Right Ventricle',
        category: 'chamber',
        side: 'left',
        x: 43,
        y: 74,
        description:
          'Crescent-shaped muscular chamber forming most of the anterior heart surface; pumps deoxygenated blood into the low-resistance pulmonary circuit.',
        clinicalNote:
          'Wall is ~3x thinner than the left ventricle (3–5 mm) because pulmonary arterial pressure is much lower than systemic pressure.',
      },
      {
        id: 'inferior_vena_cava',
        label: 'Inferior Vena Cava',
        category: 'vessel',
        side: 'left',
        x: 34,
        y: 83,
        description:
          'Ascends through the caval hiatus of the diaphragm (T8) to deliver venous blood from the abdomen, pelvis, and lower extremities into the right atrium.',
        clinicalNote:
          'IVC diameter and inspiratory collapse on bedside ultrasound estimate central venous pressure and volume status.',
      },

      // Right Column (7 critical structures)
      {
        id: 'aortic_arch',
        label: 'Aortic Arch & Branches',
        category: 'vessel',
        side: 'right',
        x: 49,
        y: 17,
        description:
          'High-pressure elastic arterial arch giving rise to the brachiocephalic trunk, left common carotid, and left subclavian arteries.',
        clinicalNote:
          'Contains baroreceptors sensing blood pressure; vulnerable to deceleration injury near the ligamentum arteriosum.',
      },
      {
        id: 'pulmonary_trunk',
        label: 'Pulmonary Trunk & Left Artery',
        category: 'vessel',
        side: 'right',
        x: 56,
        y: 31,
        description:
          'Emerges from the right ventricular outflow tract and bifurcates under the aortic arch into the left and right pulmonary arteries.',
        clinicalNote:
          'A prominent pulmonary artery knob on chest X-ray is a classic radiographic sign of pulmonary arterial hypertension.',
      },
      {
        id: 'left_atrium',
        label: 'Left Atrium',
        category: 'chamber',
        side: 'right',
        x: 63,
        y: 44,
        description:
          'Forms the posterior base of the heart, receiving freshly oxygenated blood from four pulmonary veins and priming the left ventricle.',
        clinicalNote:
          'Left atrial enlargement from mitral stenosis can compress the esophagus (dysphagia) or left recurrent laryngeal nerve (hoarseness).',
      },
      {
        id: 'pulmonary_valve',
        label: 'Pulmonary Semilunar Valve',
        category: 'valve',
        side: 'right',
        x: 47,
        y: 50,
        description:
          'Three pocket-like semilunar cusps guarding the exit of the right ventricle; snaps shut at the start of diastole to prevent regurgitation.',
        clinicalNote:
          'Heard best at the left 2nd intercostal space; delayed closure during inspiration produces normal physiological S2 splitting.',
      },
      {
        id: 'mitral_valve',
        label: 'Mitral (Bicuspid) Valve',
        category: 'valve',
        side: 'right',
        x: 64,
        y: 54,
        description:
          'Two-cusp left atrioventricular valve tethered by strong chordae tendineae to withstand high systolic left ventricular pressures.',
        clinicalNote:
          'Auscultated at the cardiac apex (left 5th intercostal space, midclavicular line); rheumatic fever is a leading cause of stenosis.',
      },
      {
        id: 'left_ventricle_myocardium',
        label: 'Left Ventricle & Myocardium',
        category: 'tissue',
        side: 'right',
        x: 73,
        y: 68,
        description:
          'Thickest cardiac chamber (12–15 mm myocardium lined internally by smooth endocardium) generating systemic systolic pressure (~120 mmHg).',
        clinicalNote:
          'Chronic hypertension or aortic stenosis induces concentric left ventricular hypertrophy, increasing myocardial oxygen demand.',
      },
      {
        id: 'interventricular_septum',
        label: 'Interventricular Septum',
        category: 'tissue',
        side: 'right',
        x: 56,
        y: 70,
        description:
          'Robust muscular and membranous partition separating left and right ventricles while housing the left and right bundle branches of the conduction system.',
        clinicalNote:
          'Ventricular septal defect (VSD) is the most common congenital heart anomaly, typically occurring in the membranous septum.',
      },
      {
        id: 'cardiac_apex',
        label: 'Apex of Heart',
        category: 'tissue',
        side: 'right',
        x: 67,
        y: 89,
        description:
          'Inferolateral tip formed exclusively by the left ventricle, directed downward, forward, and to the left with protective epicardial adipose tissue.',
        clinicalNote:
          'Produces the Point of Maximal Impulse (PMI) at the left 5th intercostal space; lateral displacement signals cardiomegaly.',
      },
    ],
    suggestedPrompts: [
      'Highlight blood flow sequence',
      'Focus notes on murmurs & valves',
      'Simplify for Year 1 students',
    ],
  },
  {
    id: 'brain',
    title: 'Human Brain — Midsagittal 3D Cutaway',
    shortName: 'Human Brain',
    system: 'Central Nervous System',
    summary:
      'Interactive 3D midsagittal brain anatomy highlighting cortical lobes, corpus callosum, diencephalon, cerebellum, and brainstem.',
    imageUrl: '/src/assets/images/anatomy_brain_3d_1795591456571.jpg',
    pins: [
      // Left Column (5 structures)
      {
        id: 'frontal_lobe',
        label: 'Frontal Lobe (Cerebral Cortex)',
        category: 'neural',
        side: 'left',
        x: 24,
        y: 31,
        description:
          'Anterior cortical region governing executive decision-making, working memory, voluntary motor control (precentral gyrus), and expressive speech.',
        clinicalNote:
          'Anterior cerebral artery (ACA) stroke affecting the medial frontal lobe causes contralateral lower-limb weakness and abulia.',
      },
      {
        id: 'corpus_callosum',
        label: 'Corpus Callosum',
        category: 'neural',
        side: 'left',
        x: 42,
        y: 36,
        description:
          'Largest white-matter commissural tract (~200 million myelinated axons) integrating sensory, motor, and cognitive information between hemispheres.',
        clinicalNote:
          'Splenium lesions can cause alexia without agraphia by disconnecting visual cortex input from left-hemisphere language areas.',
      },
      {
        id: 'hypothalamus',
        label: 'Hypothalamus',
        category: 'neural',
        side: 'left',
        x: 42,
        y: 50,
        description:
          'Master homeostatic control center regulating body temperature, circadian rhythms, hunger, thirst, autonomic tone, and pituitary hormone release.',
        clinicalNote:
          'Supraoptic and paraventricular nuclei synthesize ADH and oxytocin; injury can cause central diabetes insipidus.',
      },
      {
        id: 'pituitary_gland',
        label: 'Pituitary Gland (Hypophysis)',
        category: 'organ',
        side: 'left',
        x: 40,
        y: 59,
        description:
          'Pea-sized endocrine master gland suspended by the infundibulum within the sella turcica, secreting ACTH, TSH, GH, LH, FSH, prolactin, and ADH.',
        clinicalNote:
          'Pituitary macroadenomas expand superiorly to compress the optic chiasm, classically causing bitemporal hemianopsia.',
      },
      {
        id: 'pons',
        label: 'Pons',
        category: 'neural',
        side: 'left',
        x: 51,
        y: 63,
        description:
          'Prominent brainstem bridge relaying corticopontocerebellar fibers, housing cranial nerve nuclei V–VIII, and regulating sleep and respiration.',
        clinicalNote:
          'Basilar artery occlusion affecting the ventral pons can produce "locked-in syndrome" with preserved consciousness and vertical eye movement.',
      },

      // Right Column (5 structures)
      {
        id: 'parietal_lobe',
        label: 'Parietal Lobe',
        category: 'neural',
        side: 'right',
        x: 58,
        y: 20,
        description:
          'Superior cortical lobe integrating primary somatosensory touch/proprioception (postcentral gyrus), visuospatial awareness, and numeracy.',
        clinicalNote:
          'Non-dominant (usually right) parietal lobe injury produces contralateral hemispatial neglect.',
      },
      {
        id: 'occipital_lobe',
        label: 'Occipital Lobe',
        category: 'neural',
        side: 'right',
        x: 80,
        y: 42,
        description:
          'Posterior cerebral pole housing the primary visual cortex along the calcarine sulcus, decoding color, edges, motion, and visual depth.',
        clinicalNote:
          'Posterior cerebral artery (PCA) infarct causes contralateral homonymous hemianopsia often with macular sparing.',
      },
      {
        id: 'thalamus',
        label: 'Thalamus',
        category: 'neural',
        side: 'right',
        x: 49,
        y: 44,
        description:
          'Paired egg-shaped diencephalic relay hub gating all conscious sensory pathways (except olfaction) and motor feedback loops to the cortex.',
        clinicalNote:
          'Thalamic lacunar stroke (VPL/VPM nuclei) causes pure contralateral sensory loss and can trigger delayed central post-stroke pain.',
      },
      {
        id: 'cerebellum',
        label: 'Cerebellum (Arbor Vitae)',
        category: 'neural',
        side: 'right',
        x: 70,
        y: 63,
        description:
          'Posterior fossa coordinator featuring branching white-matter arbor vitae; fine-tunes motor precision, posture, gait balance, and eye tracking.',
        clinicalNote:
          'Cerebellar hemisphere lesions cause IPSILATERAL ataxia, dysmetria, and intention tremor (unlike contralateral cortical deficits).',
      },
      {
        id: 'medulla_spinal',
        label: 'Medulla Oblongata & Spinal Cord',
        category: 'neural',
        side: 'right',
        x: 58,
        y: 78,
        description:
          'Inferior brainstem containing vital cardiorespiratory centers, cranial nerve nuclei IX–XII, and the pyramidal decussation leading into the spinal cord.',
        clinicalNote:
          'Lateral medullary (Wallenberg) syndrome from PICA occlusion presents with vertigo, dysphagia, Horner syndrome, and crossed pain/temp loss.',
      },
    ],
    suggestedPrompts: [
      'Focus notes on stroke syndromes',
      'Highlight cranial nerve origins',
      'Simplify for Year 1 students',
    ],
  },
  {
    id: 'kidney',
    title: 'Human Kidney — Coronal 3D Cutaway',
    shortName: 'Human Kidney',
    system: 'Renal & Urinary System',
    summary:
      'Interactive 3D coronal kidney cutaway illustrating renal cortex, medullary pyramids, calyceal collecting system, renal vessels, and ureter.',
    imageUrl: '/src/assets/images/anatomy_kidney_3d_1795591523351.jpg',
    pins: [
      // Left Column (5 structures)
      {
        id: 'renal_capsule',
        label: 'Fibrous Renal Capsule',
        category: 'tissue',
        side: 'left',
        x: 28,
        y: 17,
        description:
          'Tough, translucent dense irregular connective-tissue sheath tightly investing the kidney surface to maintain shape and protect against infection.',
        clinicalNote:
          'Because the capsule is non-distensible, acute renal swelling stretches capsular nociceptors and produces flank pain.',
      },
      {
        id: 'renal_cortex',
        label: 'Renal Cortex',
        category: 'tissue',
        side: 'left',
        x: 26,
        y: 33,
        description:
          'Outer granular zone containing all ~1 million glomeruli, Bowman capsules, proximal/distal convoluted tubules, and erythropoietin-producing cells.',
        clinicalNote:
          'Receives ~90% of renal blood flow; cortical thinning on ultrasound is a hallmark of chronic kidney disease (CKD).',
      },
      {
        id: 'renal_pyramid',
        label: 'Renal Medulla (Pyramids)',
        category: 'organ',
        side: 'left',
        x: 34,
        y: 46,
        description:
          'Cone-shaped striated inner tissue housing Loops of Henle and collecting ducts that generate the hyperosmotic gradient for urine concentration.',
        clinicalNote:
          'Medullary tips (papillae) have relatively low blood flow and are prone to papillary necrosis in NSAID overuse, diabetes, or sickle cell disease.',
      },
      {
        id: 'renal_column',
        label: 'Renal Column (of Bertin)',
        category: 'tissue',
        side: 'left',
        x: 39,
        y: 55,
        description:
          'Inward extensions of cortical tissue projecting between adjacent renal pyramids, anchoring interlobar arteries and veins.',
        clinicalNote:
          'A hypertrophied Column of Bertin is a benign anatomical variant that can mimic a renal mass on routine ultrasonography.',
      },
      {
        id: 'minor_calyx',
        label: 'Minor Calyx',
        category: 'duct',
        side: 'left',
        x: 43,
        y: 67,
        description:
          'Cup-shaped funnel cradling the apex of each renal papilla to collect newly formed urine dripping from papillary collecting ducts.',
        clinicalNote:
          'Blunting or "clubbing" of the minor calyces on CT/IVP is an early radiographic sign of hydronephrosis.',
      },

      // Right Column (5 structures)
      {
        id: 'major_calyx',
        label: 'Major Calyx',
        category: 'duct',
        side: 'right',
        x: 51,
        y: 31,
        description:
          'Formed by the convergence of 2–3 minor calyces; channels collected urine medially into the central renal pelvis.',
        clinicalNote:
          'Large staghorn renal calculi (often struvite from Proteus infection) can branch across the major and minor calyces.',
      },
      {
        id: 'renal_artery',
        label: 'Renal Artery',
        category: 'vessel',
        side: 'right',
        x: 73,
        y: 44,
        description:
          'Direct lateral branch of the abdominal aorta delivering ~20–25% of total cardiac output directly to the kidney for plasma filtration.',
        clinicalNote:
          'Renal artery stenosis lowers afferent perfusion, activating the RAAS cascade and causing refractory secondary hypertension.',
      },
      {
        id: 'renal_vein',
        label: 'Renal Vein',
        category: 'vessel',
        side: 'right',
        x: 74,
        y: 49,
        description:
          'Large thin-walled venous vessel returning filtered, reabsorbed blood from the renal hilum directly into the inferior vena cava.',
        clinicalNote:
          'The left renal vein passes between the aorta and SMA; compression there causes "Nutcracker syndrome" with hematuria and flank pain.',
      },
      {
        id: 'renal_pelvis',
        label: 'Renal Pelvis',
        category: 'duct',
        side: 'right',
        x: 57,
        y: 52,
        description:
          'Funnel-shaped dilated upper expansion of the ureter within the renal sinus that gathers urine from all major calyces.',
        clinicalNote:
          'Ureteropelvic junction (UPJ) narrowing is the most common site of congenital urinary tract obstruction.',
      },
      {
        id: 'ureter',
        label: 'Ureter',
        category: 'duct',
        side: 'right',
        x: 68,
        y: 77,
        description:
          'Retroperitoneal smooth-muscle tube propelling urine via rhythmic peristaltic waves from the renal pelvis downward into the urinary bladder.',
        clinicalNote:
          'Kidney stones classically lodge at three anatomical constrictions: UPJ, pelvic brim (iliac crossing), and ureterovesical junction (UVJ).',
      },
    ],
    suggestedPrompts: [
      'Focus notes on kidney stones',
      'Highlight filtration & RAAS sites',
      'Simplify for nursing & med students',
    ],
  },
];

export function getAnatomyAtlasById(id: string): AnatomyAtlas {
  return ANATOMY_ATLASES.find((a) => a.id === id) ?? ANATOMY_ATLASES[0];
}
