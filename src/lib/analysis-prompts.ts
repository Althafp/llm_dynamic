export interface AnalysisPrompt {
    id: string;
    name: string;
    searchObjective: string;
    lookingFor: string;
    detectionCriteria: string;
  }
  
  // Default prompts (built-in)
  export const DEFAULT_PROMPTS: AnalysisPrompt[] = [
    {
      id: 'crowd_detection',
      name: 'Crowd Detection',
      searchObjective: 'Detect and measure the presence of large gatherings of people in Indian public areas.',
      lookingFor: 'crowd clusters or dense gatherings',
      detectionCriteria:
        'Identify large groups of people standing close together, forming clusters, or causing crowding. Focus on areas like markets, bus stands, temples, roadside shops, or footpaths where dense gatherings commonly occur in India.',
    },
    {
      id: 'no_parking',
      name: 'No Parking Violation',
      searchObjective: 'Detect vehicles parked in prohibited or restricted zones commonly seen on Indian roads.',
      lookingFor: 'illegally parked two-wheelers, cars, or autos',
      detectionCriteria:
        'Detect vehicles stopped in no-parking zones, blocking footpaths, near gates, shop entrances, bus stops, or near "No Parking" signboards. Also check for vehicles parked on narrow Indian streets causing obstruction.',
    },
    {
    id: 'garbage_detection',
    name: 'Garbage Detection',
    searchObjective: 'Identify noticeable garbage or waste accumulation in public areas.',
    lookingFor: 'visible piles of garbage, multiple litter items, or overflowing bins.',
    detectionCriteria:
        'Detect garbage only when it is clearly visible and significant enough to impact cleanliness. Valid cases include: (1) piles of trash or multiple pieces of litter grouped together, (2) overflowing garbage bins, or (3) noticeable waste dumped in open areas. Ignore very small or isolated items such as a single wrapper, cup, leaf, or tiny paper unless part of a larger littered area.',
    },

    {
    id: 'pothole_detection',
    name: 'Pothole Detection',
    searchObjective: 'Detect only those potholes or road damages that require contractor-level repair.',
    lookingFor: 'major potholes, severe cracks, structural road damage',
    detectionCriteria:
        'Identify only significant road defects that clearly require contractor repair work. Focus on deep potholes, wide cracks, broken asphalt, or road damage that affects vehicle movement or safety. Ignore small patches, surface discoloration, or minor wear and tear. Detect damage only when it is visibly substantial and cannot be ignored by municipal maintenance teams.',
    },

    {
      id: 'congestion_detection',
      name: 'Traffic Congestion',
      searchObjective: 'Analyze the level of traffic congestion in Indian road conditions.',
      lookingFor: 'slow-moving or tightly packed traffic',
      detectionCriteria:
        'Look for long queues of vehicles, closely packed traffic, minimal movement, and mixed traffic density involving cars, bikes, autos, buses, and pedestrians. Identify typical Indian congestion scenarios like bottlenecks at junctions or market areas.',
    },
    {
      id: 'wrong_driving',
      name: 'Wrong-Way / Wrong Driving',
      searchObjective: 'Detect vehicles genuinely moving against the correct traffic flow.',
      lookingFor: 'vehicles traveling opposite to the intended direction of the lane they are in.',
      detectionCriteria:
        'Detect wrong-way driving ONLY when traffic direction can be clearly understood from: \
        (1) visible road markers (arrows, dividers, medians), or \
        (2) at least one other vehicle in the same lane moving in a clear direction. \
        Ignore cases with only a single vehicle when lane direction cannot be determined. \
        Do NOT rely on camera angle, rider posture, or assumptions when direction is unclear. \
        If traffic direction cannot be confidently identified, output: "Direction unclear in this frame."'
    }
    
      
      
      
  ];

  // Export default prompts as ANALYSIS_PROMPTS for backward compatibility
  export const ANALYSIS_PROMPTS: AnalysisPrompt[] = DEFAULT_PROMPTS;
  