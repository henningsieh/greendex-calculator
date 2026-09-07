export interface Partner {
  id: string;
  name: string;
  countryCode?: string;
  website?: string;
  logo: string;
  description?: string;
}

export const PARTNERS: Partner[] = [
  {
    id: "ambitia",
    name: "Ambitia Institute",
    countryCode: "SI", // Slovenia
    website: "https://ambitia.eu/",
    logo: "/about/Ambitia-Logo.png",
    description:
      "Ambitia Institute is an institute for development of nonformal learning, mostly (but not exclusively) within the youth work. It has been established in 2012 in Slovenia. Main activities of Ambitia are organized in four departments. (1) Lab provides research and content development. We fuse different concepts of youth work to create new methodology and refine the quality of youth work. (2) Studio is turning content into a visual, audio, and graphic form. (3) Classroom uses knowledge and products as a resource for training courses, youth exchanges and other learning opportunities. We support young people in their learning processes outside of school. We offer guidance and inspiration to youth workers to evolve and create space for their professional headway. (4) Stage is offering an artistic expression for the learners.",
  },
  {
    id: "planbe",
    name: "PlanBe, Plan it, Be it",
    countryCode: "CY", // Cyprus
    website: "https://www.planbe-ngo.com/",
    logo: "/about/Plan-BE-Logo.png",
    description:
      "PlanBe, Plan it Be it, is a NGO established in March 2014, aiming at the personal and professional development of young people. The organization is based in Nicosia, Cyprus, and acts at a national and European level. PlanBe forms a platform of communication for the exchange of ideas and the productive cooperation of young people in a variety of subjects of interest. It explores youth's development through means of formal and non-formal education, while at the same time promotes European and International opportunities for active citizenship and cultural understanding. In the fast-changing societies we live in and the challenges we face today, it is important to be prepared with an alternative, backup plan. PlanBe contributes to young people's exploration for finding their own Plan B(e) and making it happen.",
  },
  {
    id: "anatta",
    name: "Stichting Anatta Foundation",
    countryCode: "NL", // The Netherlands
    website: "https://www.anattafoundation.org/",
    logo: "/about/Anatta-Logo.png",
    description:
      "The Anatta Foundation is an organization, based in the Netherlands, but working EU-wide. It's core team consists of psychologists, educators, trainers, social researchers, coaches, and entrepreneurs. The foundation focuses on three elements in its mission statement (1) Promotion of mental health; (2) Promotion of the flourishing of nature; and (3) Enhancing the nature connectedness of humans.",
  },
  {
    id: "aventura",
    name: "Aventura Marão Clube (CJ Amarante)",
    countryCode: "PT", // Portugal
    website: "https://www.cj-amarante.org/",
    logo: "/about/Aventura-Marao-Logo.png",
    description:
      "Is a local, non-profit, and civil law association created in 1993 by a group of young people from Amarante with the aim of promoting healthy lifestyles among the population (especially young people) of Amarante. It currently has more than 400 members and has 3 active sections: Mountain Biking, Canoeing and Fair Trade. In 1999, opened the 1st Portuguese Fair Trade store and, since 2008 runs the Youth Centre/ Hostel (CJ Amarante), through which it has coordinated more than 150 projects, mainly European, and involved around 5,000 young people in volunteering and participation activities. It is therefore very committed to promoting Europe and its values in the local youth community. Pillars of the organization are hhealthy lifestyles, Sustainable development, education for Human Rights, Initiative and creativity, and Intercultural dialogue.",
  },
];
