'use strict';

// Real per-topic question bank ported from StudyMate 1.9.
const REAL_QUESTIONS={
"Photosynthesis in Higher Plants":[
{q:"Photosynthesis mainly takes place in which part of the plant cell?",options:["Chloroplast","Mitochondria","Nucleus","Ribosome"],answer:0},
{q:"Which gas is released as a by-product of photosynthesis?",options:["Oxygen","Nitrogen","Carbon dioxide","Hydrogen"],answer:0},
{q:"Which pigment mainly absorbs light energy for photosynthesis?",options:["Chlorophyll","Melanin","Keratin","Insulin"],answer:0},
{q:"The light-independent reactions of photosynthesis are also called:",options:["Calvin cycle","Krebs cycle","Glycolysis","Fermentation"],answer:0},
{q:"Photosynthesis converts light energy into which form of energy?",options:["Chemical energy","Sound energy","Nuclear energy","Mechanical energy"],answer:0},
{q:"Which raw material, besides water, is essential for photosynthesis?",options:["Carbon dioxide","Nitrogen gas","Oxygen","Methane"],answer:0},
{q:"Stomata mainly help a leaf by:",options:["Allowing gas exchange for photosynthesis","Absorbing sunlight directly","Storing water permanently","Producing chlorophyll"],answer:0},
{q:"The overall raw materials for photosynthesis are:",options:["Water and carbon dioxide","Oxygen and glucose","Nitrogen and water","Glucose and chlorophyll"],answer:0}
],
"Force and Laws of Motion":[
{q:"Newton's first law of motion is also known as the law of:",options:["Inertia","Gravitation","Conservation of energy","Reflection"],answer:0},
{q:"Force is equal to mass multiplied by:",options:["Acceleration","Velocity","Distance","Time"],answer:0},
{q:"According to Newton's third law, every action has a:",options:["Equal and opposite reaction","Bigger reaction","No reaction","Delayed reaction"],answer:0},
{q:"Momentum is the product of mass and:",options:["Velocity","Force","Time","Area"],answer:0},
{q:"The SI unit of force is:",options:["Newton","Joule","Watt","Pascal"],answer:0},
{q:"An object at rest stays at rest unless acted on by:",options:["An external unbalanced force","Nothing, it stays forever","Its own mass","Gravity alone"],answer:0},
{q:"The SI unit of momentum is:",options:["kg m/s","Newton","Joule","Watt"],answer:0},
{q:"A larger mass requires a ______ force to produce the same acceleration.",options:["Larger","Smaller","Zero","Negative"],answer:0}
],
"Chemical Reactions and Equations":[
{q:"A balanced chemical equation follows the law of:",options:["Conservation of mass","Conservation of energy only","Gravity","Reflection"],answer:0},
{q:"Rusting of iron is an example of a:",options:["Oxidation reaction","Displacement of light","Physical change only","Neutral reaction"],answer:0},
{q:"In a combination reaction, two or more substances:",options:["Combine to form a new single substance","Always split apart","Never react","Cancel each other"],answer:0},
{q:"A reaction that absorbs heat from surroundings is called:",options:["Endothermic","Exothermic","Isothermic","Neutral"],answer:0},
{q:"When zinc reacts with dilute HCl, the gas released is:",options:["Hydrogen","Oxygen","Carbon dioxide","Nitrogen"],answer:0},
{q:"A decomposition reaction involves:",options:["One substance breaking into two or more","Two substances combining into one","No change in substances","Only a colour change"],answer:0},
{q:"Photosynthesis in plants is an example of a reaction that is:",options:["Endothermic","Exothermic","Explosive","Neutral"],answer:0},
{q:"A precipitation reaction produces:",options:["An insoluble solid from a solution","Only gas","Only heat","Only light"],answer:0}
],
"Electricity":[
{q:"The SI unit of electric current is:",options:["Ampere","Volt","Ohm","Watt"],answer:0},
{q:"Ohm's law relates voltage, current and:",options:["Resistance","Power","Frequency","Charge only"],answer:0},
{q:"In a series circuit, the current through each component is:",options:["The same","Always different","Zero","Doubled"],answer:0},
{q:"The device used to measure current in a circuit is a(n):",options:["Ammeter","Voltmeter","Barometer","Thermometer"],answer:0},
{q:"Electric power is measured in:",options:["Watt","Ampere","Ohm","Coulomb"],answer:0},
{q:"In a parallel circuit, the voltage across each branch is:",options:["The same as the source voltage","Always zero","Always different","Doubled"],answer:0},
{q:"The SI unit of electrical resistance is:",options:["Ohm","Ampere","Volt","Watt"],answer:0},
{q:"A fuse in a circuit is used to:",options:["Protect the circuit from excess current","Increase the voltage","Store charge","Measure resistance"],answer:0}
],
"Introduction to Trigonometry":[
{q:"In a right triangle, sin(θ) is defined as:",options:["Opposite/Hypotenuse","Adjacent/Hypotenuse","Opposite/Adjacent","Hypotenuse/Opposite"],answer:0},
{q:"The value of sin(90°) is:",options:["1","0","Undefined","0.5"],answer:0},
{q:"cos²θ + sin²θ equals:",options:["1","0","2","θ"],answer:0},
{q:"tan(θ) is equal to:",options:["sin(θ)/cos(θ)","cos(θ)/sin(θ)","1/sin(θ)","sin(θ)×cos(θ)"],answer:0},
{q:"The value of cos(0°) is:",options:["1","0","Undefined","-1"],answer:0},
{q:"The value of tan(45°) is:",options:["1","0","Undefined","0.5"],answer:0},
{q:"cosec(θ) is the reciprocal of:",options:["sin(θ)","cos(θ)","tan(θ)","cot(θ)"],answer:0},
{q:"The value of sin(0°) is:",options:["0","1","Undefined","-1"],answer:0}
],
"Cell: The Unit of Life":[
{q:"The cell was first discovered by:",options:["Robert Hooke","Charles Darwin","Isaac Newton","Gregor Mendel"],answer:0},
{q:"Which organelle is known as the 'powerhouse of the cell'?",options:["Mitochondria","Nucleus","Ribosome","Golgi body"],answer:0},
{q:"The control centre of the cell that contains genetic material is the:",options:["Nucleus","Cell wall","Vacuole","Cytoplasm"],answer:0},
{q:"Which of these is found in plant cells but not animal cells?",options:["Cell wall","Nucleus","Mitochondria","Cell membrane"],answer:0},
{q:"Ribosomes are the site of:",options:["Protein synthesis","Respiration only","Photosynthesis","Excretion"],answer:0},
{q:"The basic structural and functional unit of life is the:",options:["Cell","Tissue","Organ","Organ system"],answer:0},
{q:"The jelly-like substance filling the cell, outside the nucleus, is called:",options:["Cytoplasm","Chromatin","Cell wall","Vacuole"],answer:0},
{q:"Large vacuoles for storage are typically found in:",options:["Plant cells","Animal cells only","Bacteria only","Viruses"],answer:0}
],
"Force and Pressure":[
{q:"Pressure is defined as force acting per unit:",options:["Area","Volume","Mass","Time"],answer:0},
{q:"The SI unit of pressure is:",options:["Pascal","Newton","Joule","Watt"],answer:0},
{q:"A sharp knife cuts better than a blunt one mainly because it has:",options:["Smaller area, so higher pressure","Larger area, so lower pressure","More mass","Less force"],answer:0},
{q:"Pressure exerted by a liquid at rest is called:",options:["Fluid pressure","Magnetic pressure","Electric pressure","Frictional pressure"],answer:0},
{q:"A force can change an object's:",options:["Shape, speed or direction","Only its colour","Only its mass","Nothing at all"],answer:0},
{q:"Wide tyres on trucks are designed to:",options:["Reduce pressure on the ground by increasing area","Increase pressure on the ground","Reduce the truck's weight","Increase friction only"],answer:0}
],
"Structure of the Atom":[
{q:"The negatively charged particle in an atom is the:",options:["Electron","Proton","Neutron","Nucleon"],answer:0},
{q:"The nucleus of an atom contains:",options:["Protons and neutrons","Only electrons","Only protons","Only neutrons"],answer:0},
{q:"An atom is electrically:",options:["Neutral","Positive","Negative","Unstable always"],answer:0},
{q:"The atomic number of an element equals the number of:",options:["Protons in the nucleus","Neutrons only","Total particles","Energy levels"],answer:0},
{q:"Electrons revolve around the nucleus in:",options:["Fixed energy levels or shells","Random straight lines","The nucleus itself","No particular pattern"],answer:0},
{q:"Isotopes of an element have the same number of protons but different numbers of:",options:["Neutrons","Electrons","Protons","Atomic number"],answer:0}
],
"Light Reflection and Refraction":[
{q:"The bending of light as it passes from one medium to another is called:",options:["Refraction","Reflection","Diffraction","Dispersion"],answer:0},
{q:"A plane mirror forms an image that is:",options:["Virtual and same size as the object","Real and inverted","Always magnified","Always smaller"],answer:0},
{q:"The image formed by a concave mirror can be:",options:["Real or virtual depending on object position","Always virtual","Always real","Never formed"],answer:0},
{q:"The speed of light is highest in:",options:["Vacuum","Water","Glass","Diamond"],answer:0},
{q:"A convex lens is also called a:",options:["Converging lens","Diverging lens","Plane lens","Concave lens"],answer:0},
{q:"The angle of incidence is equal to the angle of:",options:["Reflection","Refraction only","Dispersion","Diffraction"],answer:0}
]
};

module.exports = REAL_QUESTIONS;
