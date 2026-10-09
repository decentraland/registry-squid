import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, Relation as Relation_} from "@subsquid/typeorm-store"
import {MetadataType} from "./_metadataType"
import {ThirdPartyMetadata} from "./thirdPartyMetadata.model"

@Entity_()
export class Metadata {
    constructor(props?: Partial<Metadata>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("varchar", {length: 14, nullable: false})
    type!: MetadataType

    @Index_("idx_metadata_third_party_909760c1")
    @ManyToOne_(() => ThirdPartyMetadata, {nullable: true})
    thirdParty!: Relation_<ThirdPartyMetadata> | undefined | null
}
