# Greendex Shared Language

Canonical product language shared by the Greendex applications. App-specific language lives in the glossaries listed in [GLOSSARY-MAP.md](GLOSSARY-MAP.md).

## Language

**Organization**:
A group based in exactly one EU country (`country`, a required EU code) that manages its own Users and Projects. An Organization may also be assigned to a Project as a Partner Organization through a Project Partnership.

**User**:
A person with a Greendex login who may hold roles in several Organizations and be linked to several Project Participations.
_Avoid_: Participant (when referring only to login identity)

**Organization Membership**:
A User's membership in one Organization, carrying one or more Organization-level roles. Both apps use only the defined `owner`, `admin`, `coordinator`, and `participant` values. Role lists derive from the shared auth constants; unknown or omitted role grants are refused.
_Avoid_: Project Participation

**Organization Owner**:
A User with full authority over one Organization, including its Users, settings, and Projects.
_Avoid_: Organization Administrator, Administrator

**Organization Admin**:
A User with Organization-wide administrative authority below the Organization Owner.
_Avoid_: Project Coordinator, Owner

**Project Coordinator**:
A User whose coordination authority is scoped by an explicit Project or Project Partnership assignment. Stored value `coordinator`. In Cost Tracker, the role alone grants neither Organization-wide authority nor access to an unassigned Project; Calculator recognizes the value but grants it no permissions yet. The Partner-side UI calls this actor a Group Organizer.
_Avoid_: Organization Admin, Employee, Project Manager, Coordinator

**Participant Role**:
An Organization Membership role granting Participant-facing capability in one Hosting Organization, distinct from involvement in a particular Project.
_Avoid_: Member, Project Participation

**Project**:
An initiative owned by one Organization in which Participants take part.

**Project Participation**:
One person's involvement in one specific Project, identifying the Project and the Organization represented by that person. It may later be linked to a User.
_Avoid_: Organization Membership

**Participant**:
A person viewed through a Project Participation who may contribute carbon-footprint inputs, journeys, or allocated travel costs.
_Avoid_: Member, User (when referring to participation in a Project)

**Participant Journey**:
One Participant's real journey to or from a Project, belonging to their Project Participation and shared by Calculator and Cost Tracker. It describes a personal route rather than a cost or Proof Document.
_Avoid_: Ticket, Travel Cost Entry, Partner Organization distance
