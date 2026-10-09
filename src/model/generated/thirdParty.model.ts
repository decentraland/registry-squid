import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, BooleanColumn as BooleanColumn_, Index as Index_, BigIntColumn as BigIntColumn_, ManyToOne as ManyToOne_, Relation as Relation_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {Metadata} from "./metadata.model"
import {ThirdPartyRootHistory} from "./thirdPartyRootHistory.model"

@Entity_()
export class ThirdParty {
    constructor(props?: Partial<ThirdParty>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({array: true, nullable: false})
    managers!: (string)[]

    @StringColumn_({nullable: false})
    rawMetadata!: string

    @StringColumn_({nullable: true})
    resolver!: string | undefined | null

    @Index_("idx_third_party_is_approved_f8a8d734")
    @BooleanColumn_({nullable: true})
    isApproved!: boolean | undefined | null

    @BigIntColumn_({nullable: false})
    maxItems!: bigint

    @Index_("idx_third_party_metadata_992038b6")
    @ManyToOne_(() => Metadata, {nullable: true})
    metadata!: Relation_<Metadata>

    @StringColumn_({nullable: false})
    root!: string

    @BigIntColumn_({nullable: false})
    consumedSlots!: bigint

    @BooleanColumn_({nullable: false})
    isProgrammatic!: boolean

    @StringColumn_({nullable: true})
    searchName!: string | undefined | null

    @StringColumn_({nullable: true})
    searchDescription!: string | undefined | null

    @StringColumn_({nullable: true})
    searchText!: string | undefined | null

    @OneToMany_(() => ThirdPartyRootHistory, e => e.thirdParty)
    rootHistory!: Relation_<ThirdPartyRootHistory[]>
}
