import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, Relation as Relation_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_} from "@subsquid/typeorm-store"
import {ThirdParty} from "./thirdParty.model"
import {Curation} from "./curation.model"

@Entity_()
export class Receipt {
    constructor(props?: Partial<Receipt>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_("idx_receipt_third_party_0ca1534d")
    @ManyToOne_(() => ThirdParty, {nullable: true})
    thirdParty!: Relation_<ThirdParty>

    @Index_("idx_receipt_curation_36dc0efc")
    @ManyToOne_(() => Curation, {nullable: true})
    curation!: Relation_<Curation>

    @BigIntColumn_({nullable: false})
    qty!: bigint

    @StringColumn_({nullable: false})
    signer!: string

    @BigIntColumn_({nullable: false})
    createdAt!: bigint
}
