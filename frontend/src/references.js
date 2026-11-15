// The brief supplies exactly eight DOI references. Replace each ALL_CAPS slot
// with the supplied citation and DOI. Keep the list at eight entries and do not
// add other sources: the pages are written to cite only these eight.
export const REFERENCES = [
  {
    id: 1,
    citation: 'Arcand, K. K., Schonhut-Stasik, J., Kane, S. G., Sturdevant, G., Russo, M., Watzke, M., Hsu, B., & Smith, L. F. (2024). A Universe of Sound: processing NASA data into sonifications to explore participant response. Frontiers in Communication, 9.',
    doi: '10.3389/fcomm.2024.1288896'
  },
  {
    id: 2,
    citation: 'Metatla, O., Bryan-Kinns, N., Stockman, T., & Martin, F. (2016). Sonification of reference markers for auditory graphs: effects on non-visual point estimation tasks. PeerJ Computer Science, 2, e51.',
    doi: '10.7717/peerj-cs.51'
  },
  {
    id: 3,
    citation: 'Putra, Z. P., & Setiawan, D. (2024). Representation of negative numbers: point estimation tasks using multi-reference sonification mappings. PeerJ Computer Science, 10, e2275.',
    doi: '10.7717/peerj-cs.2275'
  },
  {
    id: 4,
    citation: 'Sharif, A., Aitharaju, N., Krishnaswamy, S., & Wobbrock, J. O. (2025). Data Sonification for Screen-Reader Users: When and When Not to Use. International Web for All Conference (W4A), 160-171.',
    doi: '10.1145/3744257.3744263'
  },
  {
    id: 5,
    citation: 'Enge, K., Elmquist, E., Caiola, V., Rönnberg, N., Rind, A., Iber, M., Lenzi, S., Lan, F., Höldrich, R., & Aigner, W. (2024). Open Your Ears and Take a Look: A State-of-the-Art Report on the Integration of Sonification and Visualization. Computer Graphics Forum, 43.',
    doi: '10.1111/cgf.15114'
  },
  {
    id: 6,
    citation: 'Holloway, L. M., Goncu, C., Ilsar, A., Butler, M., & Marriott, K. (2022). Infosonics: Accessible Infographics for People who are Blind using Sonification and Voice. CHI Conference on Human Factors in Computing Systems, 1-13.',
    doi: '10.1145/3491102.3517465'
  },
  {
    id: 7,
    citation: 'Hoque, M. N., Ehtesham-Ul-Haque, M., Elmqvist, N., & Billah, S. M. (2023). Accessible Data Representation with Natural Sound. CHI Conference on Human Factors in Computing Systems, 1-19.',
    doi: '10.1145/3544548.3581087'
  },
  {
    id: 8,
    citation: 'Seo, J., Xia, Y., Lee, B., McCurry, S., & Yam, Y. (2024). MAIDR: Making Statistical Visualizations Accessible with Multimodal Data Representation. CHI Conference on Human Factors in Computing Systems, 1-22.',
    doi: '10.1145/3613904.3642730'
  },
];

export function isDoi(value) {
  return /^10\.\d{4,9}\//.test(value);
}
