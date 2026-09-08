# Greendex Shared Language

Greendex shares Organization, Project, and participation identities across applications while keeping carbon-footprint calculation and cost tracking as separate contexts.

## Language

**Organization**:
A group that manages its own users and Projects or participates in Projects owned by another Organization.

**User**:
A person with a Greendex login. A User may hold several roles in several Organizations and may be linked to several Project Participations.
_Avoid_: Participant (when referring only to login identity)

**Organization Membership**:
A User's membership in one Organization. A Membership may assign several distinct Organization-level roles to the User.
_Avoid_: Project Participation

**Organization Administrator**:
A User with Organization-wide responsibility and authority over the Organization, its Users, and its Projects.
_Avoid_: Administrator, Owner, Employee

**Project Coordinator**:
A User responsible for managing Projects and coordinating Participants, without the Organization-wide authority of an Organization Administrator.
_Avoid_: Employee, Project Manager, Coordinator

**Participant Role**:
A persistent Organization-level role that grants Participant-facing permissions. It may coexist with other roles on the same Organization Membership and does not identify the Projects in which the User participates.
_Avoid_: Member, Project Participation

**Project**:
An initiative owned by one Organization in which Participants take part.

**Project Participation**:
One person's involvement in one specific Project. It identifies the Project and the Organization represented by that person; it may later be linked to a User.
_Avoid_: Organization Membership

**Participant**:
A person viewed through a Project Participation. A Participant may contribute application-specific data such as carbon-footprint inputs or allocated travel costs.
_Avoid_: Member, User (when referring to participation in a Project)
